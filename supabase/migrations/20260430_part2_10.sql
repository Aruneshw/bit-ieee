-- IEEE Hub extension migration (2026-04-30)
-- Goal: Implement Parts 2–10 additively WITHOUT breaking existing tables/routes.
-- Safe to run on existing DB: uses IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS.

-- =========================
-- 1) Extensions
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =========================
-- 2) Users (profiles) fields
-- =========================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- Keep existing "mobile" but also mirror into phone_number going forward (app-level).
-- Roll number already exists as users.roll_number; enforce uniqueness if not present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'u'
      AND conname = 'users_roll_number_unique'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_roll_number_unique UNIQUE (roll_number);
  END IF;
END $$;

-- =========================
-- 3) Events table extensions (do not remove legacy columns)
-- =========================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer_name text,
  ADD COLUMN IF NOT EXISTS organizer_department text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS detailed_description text,
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS attendance_type text DEFAULT 'otp',
  ADD COLUMN IF NOT EXISTS max_capacity integer DEFAULT 70,
  ADD COLUMN IF NOT EXISTS current_bookings integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Expand status constraint to include ongoing/completed (keep existing semantics).
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.events'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.events
    ADD CONSTRAINT events_status_check
    CHECK (status IN ('pending','approved','rejected','ongoing','completed'));
END $$;

CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_venue_date ON public.events(venue, event_date);

-- =========================
-- 4) New tables: bookings / otps / attendance / event_team
--    (Keep legacy public.event_bookings table unchanged)
-- =========================
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booked_at timestamptz DEFAULT now(),
  attended_start boolean DEFAULT false,
  attended_end boolean DEFAULT false,
  UNIQUE(event_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_member ON public.bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event ON public.bookings(event_id);

CREATE TABLE IF NOT EXISTS public.otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  otp_type text NOT NULL CHECK (otp_type IN ('start','end')),
  otp_code text NOT NULL CHECK (otp_code ~ '^[0-9]{6}$'),
  issued_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  valid_seconds integer NOT NULL CHECK (valid_seconds IN (30, 60, 90)),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otps_active_lookup ON public.otps(event_id, otp_type, otp_code) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  otp_type text NOT NULL CHECK (otp_type IN ('start','end')),
  marked_at timestamptz DEFAULT now(),
  UNIQUE(event_id, member_id, otp_type)
);

CREATE INDEX IF NOT EXISTS idx_attendance_event_type ON public.attendance(event_id, otp_type);

CREATE TABLE IF NOT EXISTS public.event_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  assigned_by uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_team_event ON public.event_team(event_id);

-- =========================
-- 5) RLS enablement (additive)
-- =========================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_team ENABLE ROW LEVEL SECURITY;

-- Helper predicate: is admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin_primary');
$$;

-- Helper: is organizer of an event?
CREATE OR REPLACE FUNCTION public.is_event_organizer(eid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = eid AND e.organiser_id = auth.uid());
$$;

-- Events policies: do not drop existing ones; only add missing ones for new behavior.
-- Approved events visible to any authenticated user (already has society-based select in v3,
-- but we add this to support cross-society "Current Events" without breaking existing).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='events' AND policyname='Authenticated can view approved events'
  ) THEN
    CREATE POLICY "Authenticated can view approved events"
      ON public.events FOR SELECT
      USING (auth.role() = 'authenticated' AND status = 'approved');
  END IF;
END $$;

-- Members/Leadership can submit events (pending) as activity requests.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='events' AND policyname='Members can insert pending events'
  ) THEN
    CREATE POLICY "Members can insert pending events"
      ON public.events FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role IN ('membership', 'leadership')
        )
      );
  END IF;
END $$;

-- Organizer can view own events of any status.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='events' AND policyname='Organizer can view own events'
  ) THEN
    CREATE POLICY "Organizer can view own events"
      ON public.events FOR SELECT
      USING (organiser_id = auth.uid());
  END IF;
END $$;

-- Organizer can update own pending events (non-status fields) – enforced by app and RLS UPDATE restriction.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='events' AND policyname='Organizer can update own pending events'
  ) THEN
    CREATE POLICY "Organizer can update own pending events"
      ON public.events FOR UPDATE
      USING (organiser_id = auth.uid() AND status = 'pending')
      WITH CHECK (organiser_id = auth.uid());
  END IF;
END $$;

-- Bookings policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='Members select own bookings') THEN
    CREATE POLICY "Members select own bookings"
      ON public.bookings FOR SELECT
      USING (member_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='Members insert own bookings') THEN
    CREATE POLICY "Members insert own bookings"
      ON public.bookings FOR INSERT
      WITH CHECK (member_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='Organizer selects bookings for their events') THEN
    CREATE POLICY "Organizer selects bookings for their events"
      ON public.bookings FOR SELECT
      USING (public.is_event_organizer(event_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='Admins manage all bookings') THEN
    CREATE POLICY "Admins manage all bookings"
      ON public.bookings FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- OTP policies: only issuer or admin can see/insert/update.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otps' AND policyname='Issuer/admin can select otps') THEN
    CREATE POLICY "Issuer/admin can select otps"
      ON public.otps FOR SELECT
      USING (issued_by = auth.uid() OR public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otps' AND policyname='Organizer or admin can insert otps') THEN
    CREATE POLICY "Organizer or admin can insert otps"
      ON public.otps FOR INSERT
      WITH CHECK (
        issued_by = auth.uid()
        AND (public.is_admin() OR public.is_event_organizer(event_id))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otps' AND policyname='Issuer/admin can update otps') THEN
    CREATE POLICY "Issuer/admin can update otps"
      ON public.otps FOR UPDATE
      USING (issued_by = auth.uid() OR public.is_admin())
      WITH CHECK (issued_by = auth.uid() OR public.is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otps' AND policyname='Admins can delete otps') THEN
    CREATE POLICY "Admins can delete otps"
      ON public.otps FOR DELETE
      USING (public.is_admin());
  END IF;
END $$;

-- Attendance policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Members see own attendance') THEN
    CREATE POLICY "Members see own attendance"
      ON public.attendance FOR SELECT
      USING (member_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Organizer and admin see event attendance') THEN
    CREATE POLICY "Organizer and admin see event attendance"
      ON public.attendance FOR SELECT
      USING (public.is_admin() OR public.is_event_organizer(event_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Members insert own attendance if booked') THEN
    CREATE POLICY "Members insert own attendance if booked"
      ON public.attendance FOR INSERT
      WITH CHECK (
        member_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.event_id = attendance.event_id AND b.member_id = auth.uid())
      );
  END IF;
END $$;

-- Event team policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_team' AND policyname='All authenticated can view event team') THEN
    CREATE POLICY "All authenticated can view event team"
      ON public.event_team FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_team' AND policyname='Admins manage event team') THEN
    CREATE POLICY "Admins manage event team"
      ON public.event_team FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Public limited profile access:
-- RLS cannot restrict columns, so we provide a view with only allowed fields for public pages.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  u.full_name,
  u.department,
  u.society_id,
  u.role
FROM public.users u;

GRANT SELECT ON public.public_profiles TO anon;

-- =========================
-- 6) Atomic booking function (capacity + increment)
-- =========================
CREATE OR REPLACE FUNCTION public.book_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_current int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE(max_capacity, 70), COALESCE(current_bookings, 0)
    INTO v_max, v_current
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Event not found');
  END IF;

  IF v_current >= v_max THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Event is full');
  END IF;

  INSERT INTO public.bookings(event_id, member_id)
  VALUES (p_event_id, auth.uid());

  UPDATE public.events
  SET current_bookings = COALESCE(current_bookings, 0) + 1
  WHERE id = p_event_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already booked');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Booking failed');
END;
$$;

REVOKE ALL ON FUNCTION public.book_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_event(uuid) TO authenticated;

-- =========================
-- 6) OTP validation function (server-side)
-- =========================
CREATE OR REPLACE FUNCTION public.validate_and_mark_attendance(
  p_event_id uuid,
  p_otp_code text,
  p_otp_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF p_otp_type NOT IN ('start','end') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid OTP type');
  END IF;

  SELECT *
  INTO v_otp
  FROM public.otps
  WHERE event_id = p_event_id
    AND otp_code = p_otp_code
    AND otp_type = p_otp_type
    AND is_active = true
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired OTP. Please try again.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.event_id = p_event_id AND b.member_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have not booked this event. Please register first.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.attendance a WHERE a.event_id = p_event_id AND a.member_id = auth.uid() AND a.otp_type = p_otp_type) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already marked your attendance for this OTP.');
  END IF;

  INSERT INTO public.attendance(event_id, member_id, otp_type)
  VALUES (p_event_id, auth.uid(), p_otp_type);

  IF p_otp_type = 'start' THEN
    UPDATE public.bookings SET attended_start = true WHERE event_id = p_event_id AND member_id = auth.uid();
  ELSE
    UPDATE public.bookings SET attended_end = true WHERE event_id = p_event_id AND member_id = auth.uid();
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', '✓ Attendance marked successfully!');
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already marked your attendance for this OTP.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Attendance marking failed.');
END;
$$;

REVOKE ALL ON FUNCTION public.validate_and_mark_attendance(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_and_mark_attendance(uuid, text, text) TO authenticated;

-- =========================
-- 7) Cleanup cron job (hourly)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ieee-hub-event-cleanup') THEN
    PERFORM cron.schedule(
      'ieee-hub-event-cleanup',
      '0 * * * *',
      $$
        DELETE FROM public.events
        WHERE status = 'rejected'
           OR (
                status = 'completed'
                AND (
                  event_date < current_date
                  OR (event_date = current_date AND end_time < current_time)
                )
              );
      $$
    );
  END IF;
END $$;

