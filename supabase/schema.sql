-- IEEE Society Hub — Database Schema (v3 — Single Admin Role)
-- Safe to run on fresh OR existing databases.
-- Run this in Supabase SQL Editor.

-- ============================================
-- MIGRATION: Remove admin_secondary from existing data
-- ============================================
DO $$
BEGIN
  -- Migrate any existing admin_secondary users to admin_primary
  IF EXISTS (SELECT 1 FROM users WHERE role = 'admin_secondary') THEN
    UPDATE users SET role = 'admin_primary' WHERE role = 'admin_secondary';
  END IF;
END $$;

-- ============================================
-- TABLES (CREATE IF NOT EXISTS — safe to re-run)
-- ============================================

CREATE TABLE IF NOT EXISTS societies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT,
  department TEXT,
  total_members INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'membership',
  society_id UUID REFERENCES societies(id) ON DELETE SET NULL,
  dob DATE,
  gender TEXT CHECK (gender IN ('Male','Female','Prefer not to say') OR gender IS NULL),
  mobile TEXT,
  personal_email TEXT,
  department TEXT,
  year TEXT CHECK (year IN ('1st','2nd','3rd','4th') OR year IS NULL),
  roll_number TEXT,
  github TEXT,
  linkedin TEXT,
  portfolio TEXT,
  primary_skills TEXT,
  secondary_skills TEXT,
  bio TEXT,
  profile_completed BOOLEAN DEFAULT false,
  activity_points INT DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  detailed_description TEXT,
  society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
  organiser_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organizer_name TEXT,
  organizer_department TEXT,
  skill_type TEXT CHECK (skill_type IN ('primary','secondary')),
  selected_skill TEXT,
  event_type TEXT CHECK (event_type IN ('hardware','software')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  date TIMESTAMPTZ,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  photo_proof TEXT,
  students_attended INT DEFAULT 0,
  booking_enabled BOOLEAN DEFAULT false,
  max_capacity INT DEFAULT 0,
  current_bookings INT DEFAULT 0,
  attendance_type TEXT DEFAULT 'otp',
  admin_notes TEXT,
  is_ieee_official BOOLEAN DEFAULT false,
  external_reference_id TEXT UNIQUE,
  external_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  points INT NOT NULL DEFAULT 0,
  event_name TEXT,
  organised_by TEXT,
  organiser_email TEXT,
  date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq','coding')),
  otp TEXT UNIQUE,
  otp_expires_at TIMESTAMPTZ,
  questions JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '[]'::jsonb,
  score INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like','comment')),
  comment_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_role TEXT,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','event_request','approval','rejection','announcement')),
  read BOOLEAN DEFAULT false,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  personal_info JSONB DEFAULT '{}'::jsonb,
  online_presence JSONB DEFAULT '{}'::jsonb,
  skills JSONB DEFAULT '{}'::jsonb,
  bio TEXT,
  society TEXT,
  events_attended JSONB DEFAULT '[]'::jsonb,
  certificates JSONB DEFAULT '[]'::jsonb,
  projects JSONB DEFAULT '[]'::jsonb,
  hackathons JSONB DEFAULT '[]'::jsonb,
  publications JSONB DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- FIX ROLE CHECK CONSTRAINT (remove admin_secondary)
-- ============================================
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND contype = 'c'
    AND conname LIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin_primary','student_rep','leadership','membership','event_manager'));

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_society ON users(society_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_events_society ON events(society_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_activity_points_user ON activity_points(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_event ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_user ON task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_society ON notifications(society_id);
CREATE INDEX IF NOT EXISTS idx_posts_society ON posts(society_id);

-- ============================================
-- PERFORMANCE VIEWS
-- ============================================

-- Society Stats View (Eliminates N+1 in Dashboard)
CREATE OR REPLACE VIEW view_society_stats AS
SELECT 
  s.id,
  s.name,
  s.abbreviation,
  COALESCE(SUM(u.activity_points), 0) as total_points,
  COUNT(u.id) as total_members
FROM societies s
LEFT JOIN users u ON s.id = u.society_id
GROUP BY s.id, s.name, s.abbreviation;

-- Leader Performance View (Eliminates N+1 in Spreadsheets)
CREATE OR REPLACE VIEW view_leader_performance AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.activity_points,
  u.primary_skills,
  s.abbreviation as society_abbreviation,
  COUNT(e.id) as events_conducted,
  (COALESCE(u.activity_points, 0) + (COUNT(e.id) * 5)) as total_score
FROM users u
LEFT JOIN societies s ON u.society_id = s.id
LEFT JOIN events e ON u.id = e.organiser_id AND e.status = 'approved'
WHERE u.role IN ('leadership', 'event_manager')
GROUP BY u.id, u.name, u.email, u.role, u.activity_points, u.primary_skills, s.abbreviation;

-- ============================================
-- PRE-SEED IEEE SOCIETIES
-- ============================================
INSERT INTO societies (name, abbreviation, department) VALUES
  ('Engineering in Medicine and Biology Society', 'EMBS', 'BME'),
  ('Power and Energy Society', 'PES', 'EEE'),
  ('Oceanic Engineering Society', 'OES', 'MECH'),
  ('Robotics and Automation Society', 'RAS', 'MECH'),
  ('Computational Intelligence Society', 'CIS', 'CSE'),
  ('Computer Society', 'CS', 'CSE'),
  ('Power Electronics Society', 'PELS', 'EEE'),
  ('Circuits and Systems Society', 'CASS', 'ECE'),
  ('Electron Devices Society', 'EDS', 'ECE'),
  ('Control Systems Society', 'CSS', 'EIE'),
  ('Intelligent Transportation Systems Society', 'ITSS', 'CSE')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- ── Drop ONLY our policies on managed tables (safe if already gone) ──
DO $$
DECLARE
  pol RECORD;
  managed_tables TEXT[] := ARRAY['societies','users','events','activity_points','tasks','task_submissions','event_bookings','posts','post_interactions','notifications','resumes'];
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(managed_tables)
  LOOP
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ── SECURITY DEFINER helper functions (bypass RLS for policy checks) ──
-- These prevent infinite recursion when users-table policies sub-query users.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_society_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT society_id FROM public.users WHERE id = auth.uid();
$$;

-- ── Recreate policies (using helper functions to avoid recursion) ──

-- Societies
CREATE POLICY "Societies are viewable by everyone" ON societies FOR SELECT USING (true);
CREATE POLICY "Only admins can modify societies" ON societies FOR ALL USING (
  public.get_my_role() = 'admin_primary'
);

-- Users (NO sub-queries on users — use helper functions or auth.uid() directly)
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (
  public.get_my_role() = 'admin_primary'
);
CREATE POLICY "Society members are visible (Safe Fields Only)" ON users FOR SELECT USING (
  society_id = public.get_my_society_id()
);
-- Note: We rely on frontend to only select (id, name, email, role, society_id, activity_points, avatar_url) 
-- for non-admin society views.
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can manage all users" ON users FOR ALL USING (
  public.get_my_role() = 'admin_primary'
);

-- Events
CREATE POLICY "Admins can manage all events" ON events FOR ALL USING (
  public.get_my_role() = 'admin_primary'
);
CREATE POLICY "Society members can view their events" ON events FOR SELECT USING (
  society_id = public.get_my_society_id()
);
CREATE POLICY "Members can submit event requests" ON events FOR INSERT WITH CHECK (
  public.get_my_role() IN ('membership','leadership','event_manager')
);

-- Activity Points
CREATE POLICY "Users view own points" ON activity_points FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage all points" ON activity_points FOR ALL USING (
  public.get_my_role() = 'admin_primary'
);

-- Tasks
CREATE POLICY "Admins manage tasks" ON tasks FOR ALL USING (
  public.get_my_role() IN ('admin_primary','leadership','event_manager')
);
CREATE POLICY "Booked users see tasks" ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM event_bookings WHERE event_id = tasks.event_id AND user_id = auth.uid())
);

-- Task Submissions
CREATE POLICY "Users manage own submissions" ON task_submissions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins view all submissions" ON task_submissions FOR SELECT USING (
  public.get_my_role() IN ('admin_primary','leadership')
);

CREATE TABLE IF NOT EXISTS event_team (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins can manage event teams" ON event_team FOR ALL USING (
  public.get_my_role() IN ('admin_primary','leadership')
);

CREATE POLICY "Everyone can view event teams" ON event_team FOR SELECT USING (true);

ALTER TABLE event_team ENABLE ROW LEVEL SECURITY;

-- Event Bookings
CREATE POLICY "Users manage own bookings" ON event_bookings FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins manage bookings" ON event_bookings FOR ALL USING (
  public.get_my_role() = 'admin_primary'
);

-- Posts
CREATE POLICY "Society members see posts" ON posts FOR SELECT USING (
  society_id = public.get_my_society_id()
  OR public.get_my_role() = 'admin_primary'
);
CREATE POLICY "Reps and admins create posts" ON posts FOR INSERT WITH CHECK (
  public.get_my_role() IN ('student_rep','admin_primary')
);
CREATE POLICY "Authors manage own posts" ON posts FOR UPDATE USING (author_id = auth.uid());

-- Post Interactions
CREATE POLICY "Users interact with visible posts" ON post_interactions FOR ALL USING (
  EXISTS (SELECT 1 FROM posts WHERE id = post_interactions.post_id
    AND society_id = public.get_my_society_id())
);

-- Notifications
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (
  recipient_id = auth.uid()
  OR society_id = public.get_my_society_id()
  OR recipient_role = public.get_my_role()
);
CREATE POLICY "Authorized users create notifications" ON notifications FOR INSERT WITH CHECK (
  public.get_my_role() IN ('admin_primary','student_rep','leadership')
);

-- Resumes
CREATE POLICY "Users manage own resume" ON resumes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins view resumes" ON resumes FOR SELECT USING (
  public.get_my_role() = 'admin_primary'
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  existing_row RECORD;
  user_role TEXT;
BEGIN
  SELECT * INTO existing_row FROM public.users WHERE email = NEW.email;

  IF existing_row IS NOT NULL THEN
    UPDATE public.users SET
      id = NEW.id,
      name = COALESCE(existing_row.name, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', existing_row.avatar_url, ''),
      updated_at = now()
    WHERE email = NEW.email;
  ELSE
    IF NEW.email NOT LIKE '%@bitsathy.ac.in' AND NEW.email NOT IN ('bitieeehubadmin1@gmail.com', 'bitieeehubadmin2@gmail.com', 'aruneshownsty1@gmail.com', 'bitieeehubadmin3@gmail.com', 'bitieeehubadmin4@gmail.com') THEN
      RAISE EXCEPTION 'invalid user';
    END IF;

    IF NEW.email IN ('bitieeehubadmin1@gmail.com', 'bitieeehubadmin2@gmail.com', 'aruneshownsty1@gmail.com', 'bitieeehubadmin3@gmail.com', 'bitieeehubadmin4@gmail.com') THEN
      user_role := 'admin_primary';
    ELSE
      user_role := 'membership';
    END IF;

    INSERT INTO public.users (id, email, name, role, avatar_url, profile_completed)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      user_role,
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
      CASE WHEN user_role = 'admin_primary' THEN true ELSE false END
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_user_total_points()
RETURNS trigger AS $$
BEGIN
  UPDATE users SET activity_points = (
    SELECT COALESCE(SUM(points), 0) FROM activity_points WHERE user_id = NEW.user_id
  ), updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_activity_points_change ON activity_points;
CREATE TRIGGER on_activity_points_change
  AFTER INSERT OR UPDATE OR DELETE ON activity_points
  FOR EACH ROW EXECUTE FUNCTION public.update_user_total_points();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Create 'media' bucket for post attachments & resume PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Media is publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;

-- Allow authenticated users to upload media
CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

-- Allow public to view media (bucket is public, but explicit policy)
CREATE POLICY "Media is publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Allow users to update/delete their own media
CREATE POLICY "Users can update own media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media' AND auth.uid() = owner);

CREATE POLICY "Users can delete own media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.uid() = owner);
