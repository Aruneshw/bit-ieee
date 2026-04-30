-- IEEE Society Hub — Full Database Schema (v2)
-- Run this in Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- Societies table
CREATE TABLE IF NOT EXISTS societies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT,
  department TEXT,
  total_members INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users table (extended profile fields for resume)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'membership' 
    CHECK (role IN ('admin_primary','admin_secondary','student_rep','leadership','membership','event_manager')),
  society_id UUID REFERENCES societies(id) ON DELETE SET NULL,
  -- Personal info
  dob DATE,
  gender TEXT CHECK (gender IN ('Male','Female','Prefer not to say') OR gender IS NULL),
  mobile TEXT,
  personal_email TEXT,
  -- Academic info
  department TEXT,
  year TEXT CHECK (year IN ('1st','2nd','3rd','4th') OR year IS NULL),
  roll_number TEXT,
  -- Online presence
  github TEXT,
  linkedin TEXT,
  portfolio TEXT,
  -- Skills (stored as comma-separated or JSON text)
  primary_skills TEXT,
  secondary_skills TEXT,
  -- Bio
  bio TEXT,
  -- Status
  profile_completed BOOLEAN DEFAULT false,
  activity_points INT DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  society_id UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  organiser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_type TEXT CHECK (skill_type IN ('primary','secondary')),
  selected_skill TEXT,
  event_type TEXT CHECK (event_type IN ('hardware','software')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  date TIMESTAMPTZ,
  venue TEXT,
  photo_proof TEXT,
  students_attended INT DEFAULT 0,
  booking_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity Points table
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

-- Tasks table
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

-- Task Submissions table
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

-- Event Bookings table
CREATE TABLE IF NOT EXISTS event_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Posts table
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

-- Post Interactions table
CREATE TABLE IF NOT EXISTS post_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like','comment')),
  comment_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications table
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

-- Resumes table (restructured with JSON columns for resume sections)
CREATE TABLE IF NOT EXISTS resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- Resume sections as JSONB
  personal_info JSONB DEFAULT '{}'::jsonb,
  online_presence JSONB DEFAULT '{}'::jsonb,
  skills JSONB DEFAULT '{}'::jsonb,
  bio TEXT,
  society TEXT,
  -- Achievement sections
  events_attended JSONB DEFAULT '[]'::jsonb,
  certificates JSONB DEFAULT '[]'::jsonb,
  projects JSONB DEFAULT '[]'::jsonb,
  hackathons JSONB DEFAULT '[]'::jsonb,
  publications JSONB DEFAULT '[]'::jsonb,
  -- Generated PDF
  pdf_url TEXT,
  last_updated TIMESTAMPTZ DEFAULT now()
);

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

-- Societies: everyone can read
CREATE POLICY "Societies are viewable by everyone" ON societies FOR SELECT USING (true);
CREATE POLICY "Only admins can modify societies" ON societies FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);

-- Users: self access + admin access + same-society read
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);
CREATE POLICY "Same society users are visible" ON users FOR SELECT USING (
  society_id IN (SELECT society_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can manage all users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);

-- Events: society-scoped + admin access
CREATE POLICY "Admins can manage all events" ON events FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);
CREATE POLICY "Society members can view their events" ON events FOR SELECT USING (
  society_id IN (SELECT society_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Leadership can create events" ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('leadership','event_manager'))
);

-- Activity Points: user sees own, admins see all
CREATE POLICY "Users view own points" ON activity_points FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage all points" ON activity_points FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);

-- Tasks: event-booking gated
CREATE POLICY "Admins manage tasks" ON tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary','leadership','event_manager'))
);
CREATE POLICY "Booked users see tasks" ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM event_bookings WHERE event_id = tasks.event_id AND user_id = auth.uid())
);

-- Task Submissions
CREATE POLICY "Users manage own submissions" ON task_submissions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins view all submissions" ON task_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary','leadership'))
);

-- Event Bookings
CREATE POLICY "Users manage own bookings" ON event_bookings FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins manage bookings" ON event_bookings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);

-- Posts: society-scoped
CREATE POLICY "Society members see posts" ON posts FOR SELECT USING (
  society_id IN (SELECT society_id FROM users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);
CREATE POLICY "Reps and admins create posts" ON posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('student_rep','admin_primary','admin_secondary'))
);
CREATE POLICY "Authors manage own posts" ON posts FOR UPDATE USING (author_id = auth.uid());

-- Post Interactions
CREATE POLICY "Users interact with visible posts" ON post_interactions FOR ALL USING (
  EXISTS (SELECT 1 FROM posts WHERE id = post_interactions.post_id 
    AND society_id IN (SELECT society_id FROM users WHERE id = auth.uid()))
);

-- Notifications: recipient sees own
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (
  recipient_id = auth.uid() 
  OR society_id IN (SELECT society_id FROM users WHERE id = auth.uid())
  OR recipient_role IN (SELECT role FROM users WHERE id = auth.uid())
);
CREATE POLICY "Authorized users create notifications" ON notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary','student_rep','leadership'))
);

-- Resumes: user accesses own only
CREATE POLICY "Users manage own resume" ON resumes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins view resumes" ON resumes FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin_primary','admin_secondary'))
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to handle new user creation from auth.
-- CRITICAL: Admin pre-populates rows by email BEFORE the user ever logs in.
-- Those rows have a placeholder id (or no id). On first auth login, 
-- Supabase creates auth.users → this trigger links them.
-- If a row already exists for this email, UPDATE it with the auth id.
-- If no row exists (e.g. admin emails), INSERT a fresh one.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  existing_row RECORD;
  user_role TEXT;
BEGIN
  -- Check if admin pre-populated a row for this email
  SELECT * INTO existing_row FROM public.users WHERE email = NEW.email;

  IF existing_row IS NOT NULL THEN
    -- Row was pre-created by admin import. Link the auth id to it.
    UPDATE public.users SET
      id = NEW.id,
      name = COALESCE(existing_row.name, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', existing_row.avatar_url, ''),
      updated_at = now()
    WHERE email = NEW.email;
  ELSE
    -- No pre-populated row. Check domain before proceeding.
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
      CASE WHEN user_role IN ('admin_primary','admin_secondary') THEN true ELSE false END
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update user activity points total
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
