-- Add otp_pushes table for End-OTP QR push to members

CREATE TABLE IF NOT EXISTS public.otp_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  otp_type text NOT NULL CHECK (otp_type IN ('end')),
  otp_code text NOT NULL CHECK (otp_code ~ '^[0-9]{6}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.otp_pushes ENABLE ROW LEVEL SECURITY;

-- Members who have attended_start=true can read end OTP pushes for that event.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otp_pushes' AND policyname='Members with start attendance can read end pushes') THEN
    CREATE POLICY "Members with start attendance can read end pushes"
      ON public.otp_pushes FOR SELECT
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.event_id = otp_pushes.event_id
            AND b.member_id = auth.uid()
            AND b.attended_start = true
        )
      );
  END IF;
END $$;

-- Organizer/admin can insert pushes (must be organizer or admin).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='otp_pushes' AND policyname='Organizer/admin can insert end pushes') THEN
    CREATE POLICY "Organizer/admin can insert end pushes"
      ON public.otp_pushes FOR INSERT
      WITH CHECK (public.is_admin() OR public.is_event_organizer(event_id));
  END IF;
END $$;

