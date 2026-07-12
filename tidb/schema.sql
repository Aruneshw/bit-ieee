-- ============================================================================
-- IEEE Hub — TiDB Cloud Schema (MySQL-compatible)
-- Run this in TiDB Cloud SQL Editor or via mysql client
-- ============================================================================

-- STEP 1: Run this line ALONE first:
CREATE DATABASE IF NOT EXISTS ieee_hub;

-- STEP 2: After Step 1 succeeds, select "ieee_hub" from the database
--         dropdown (top-right), then run everything BELOW this line.


-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS societies (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  abbreviation VARCHAR(50),
  department VARCHAR(100),
  total_members INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'membership',
  society_id VARCHAR(36),
  dob DATE,
  gender VARCHAR(30),
  mobile VARCHAR(20),
  personal_email VARCHAR(255),
  department VARCHAR(100),
  year VARCHAR(10),
  roll_number VARCHAR(50),
  github VARCHAR(255),
  linkedin VARCHAR(255),
  portfolio VARCHAR(255),
  primary_skills TEXT,
  secondary_skills TEXT,
  bio TEXT,
  profile_completed BOOLEAN DEFAULT FALSE,
  activity_points INT DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE SET NULL,
  CHECK (role IN ('admin_primary','student_rep','leadership','membership','event_manager')),
  CHECK (gender IN ('Male','Female','Prefer not to say') OR gender IS NULL),
  CHECK (year IN ('1st','2nd','3rd','4th') OR year IS NULL)
);

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  short_description TEXT,
  detailed_description TEXT,
  society_id VARCHAR(36),
  organiser_id VARCHAR(36),
  organizer_name VARCHAR(255),
  organizer_department VARCHAR(100),
  skill_type VARCHAR(20),
  selected_skill VARCHAR(255),
  event_type VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  date TIMESTAMP NULL,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  venue VARCHAR(255),
  photo_proof TEXT,
  students_attended INT DEFAULT 0,
  booking_enabled BOOLEAN DEFAULT FALSE,
  max_capacity INT DEFAULT 0,
  current_bookings INT DEFAULT 0,
  attendance_type VARCHAR(20) DEFAULT 'otp',
  admin_notes TEXT,
  is_ieee_official BOOLEAN DEFAULT FALSE,
  external_reference_id VARCHAR(255) UNIQUE,
  external_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (organiser_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (skill_type IN ('primary','secondary') OR skill_type IS NULL),
  CHECK (event_type IN ('hardware','software') OR event_type IS NULL),
  CHECK (status IN ('pending','approved','rejected'))
);

CREATE TABLE IF NOT EXISTS activity_points (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  event_id VARCHAR(36),
  points INT NOT NULL DEFAULT 0,
  event_name VARCHAR(255),
  organised_by VARCHAR(255),
  organiser_email VARCHAR(255),
  date TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  title TEXT,
  description TEXT,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  otp VARCHAR(50) UNIQUE,
  otp_expires_at TIMESTAMP NULL,
  questions JSON DEFAULT ('[]'),
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY tasks_event_id_unique (event_id),
  CHECK (type IN ('mcq','coding','general')),
  CHECK (status IN ('draft','approved','archived'))
);

CREATE TABLE IF NOT EXISTS task_questions (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  options JSON DEFAULT ('[]'),
  correct_answer TEXT,
  points INT DEFAULT 10,
  sort_order INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CHECK (type IN ('mcq','coding','general')),
  CHECK (status IN ('draft','approved','rejected'))
);

CREATE TABLE IF NOT EXISTS task_submissions (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  answers JSON DEFAULT ('[]'),
  score INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  review_status VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY task_submissions_user_task_unique (user_id, task_id),
  CHECK (review_status IN ('pending','reviewed','partial'))
);

CREATE TABLE IF NOT EXISTS submission_answers (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  answer_text TEXT,
  selected_option INT,
  is_correct BOOLEAN,
  admin_remarks TEXT,
  reviewed_by VARCHAR(36),
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES task_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES task_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  UNIQUE KEY submission_answers_sub_q_unique (submission_id, question_id)
);

CREATE TABLE IF NOT EXISTS event_bookings (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY event_bookings_event_user_unique (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_team (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  role VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  society_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  content TEXT,
  media_url TEXT,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_interactions (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  comment_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (type IN ('like','comment'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  recipient_role VARCHAR(50),
  recipient_id VARCHAR(36),
  society_id VARCHAR(36),
  title VARCHAR(255),
  message TEXT NOT NULL,
  type VARCHAR(30) DEFAULT 'info',
  `read` BOOLEAN DEFAULT FALSE,
  sent_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (type IN ('info','event_request','approval','rejection','announcement'))
);

CREATE TABLE IF NOT EXISTS resumes (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  personal_info JSON DEFAULT ('{}'),
  online_presence JSON DEFAULT ('{}'),
  skills JSON DEFAULT ('{}'),
  bio TEXT,
  society VARCHAR(255),
  events_attended JSON DEFAULT ('[]'),
  certificates JSON DEFAULT ('[]'),
  projects JSON DEFAULT ('[]'),
  hackathons JSON DEFAULT ('[]'),
  publications JSON DEFAULT ('[]'),
  pdf_url TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- CIRCUIT CHALLENGE SANDBOX (ephemeral)
-- ============================================

CREATE TABLE IF NOT EXISTS circuit_sessions (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  host_id VARCHAR(36) NOT NULL,
  tinkercad_url TEXT NOT NULL,
  question_text TEXT NOT NULL,
  reference_answer TEXT,
  reference_image_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS circuit_sandbox (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  screenshot_url TEXT NOT NULL,
  ai_score INT DEFAULT 0,
  ai_feedback TEXT,
  graded BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES circuit_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY circuit_sandbox_session_user (session_id, user_id)
);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
CREATE INDEX idx_users_society ON users(society_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_events_society ON events(society_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_society_id ON events(society_id);
CREATE INDEX idx_activity_points_user ON activity_points(user_id);
CREATE INDEX idx_tasks_event ON tasks(event_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_questions_task_id ON task_questions(task_id);
CREATE INDEX idx_task_questions_status ON task_questions(status);
CREATE INDEX idx_task_questions_task_status ON task_questions(task_id, status);
CREATE INDEX idx_task_submissions_user ON task_submissions(user_id);
CREATE INDEX idx_task_submissions_task ON task_submissions(task_id);
CREATE INDEX idx_task_submissions_user_task ON task_submissions(user_id, task_id);
CREATE INDEX idx_submission_answers_submission ON submission_answers(submission_id);
CREATE INDEX idx_submission_answers_question ON submission_answers(question_id);
CREATE INDEX idx_event_bookings_user ON event_bookings(user_id);
CREATE INDEX idx_event_bookings_event ON event_bookings(event_id);
CREATE INDEX idx_event_bookings_user_event ON event_bookings(user_id, event_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_society ON notifications(society_id);
CREATE INDEX idx_posts_society ON posts(society_id);
CREATE INDEX idx_circuit_sessions_event ON circuit_sessions(event_id);
CREATE INDEX idx_circuit_sessions_active ON circuit_sessions(active);
CREATE INDEX idx_circuit_sandbox_session ON circuit_sandbox(session_id);
CREATE INDEX idx_circuit_sandbox_user ON circuit_sandbox(user_id);

-- ============================================
-- PRE-SEED IEEE SOCIETIES
-- ============================================
INSERT IGNORE INTO societies (id, name, abbreviation, department) VALUES
  (UUID(), 'Engineering in Medicine and Biology Society', 'EMBS', 'BME'),
  (UUID(), 'Power and Energy Society', 'PES', 'EEE'),
  (UUID(), 'Oceanic Engineering Society', 'OES', 'MECH'),
  (UUID(), 'Robotics and Automation Society', 'RAS', 'MECH'),
  (UUID(), 'Computational Intelligence Society', 'CIS', 'CSE'),
  (UUID(), 'Computer Society', 'CS', 'CSE'),
  (UUID(), 'Power Electronics Society', 'PELS', 'EEE'),
  (UUID(), 'Circuits and Systems Society', 'CASS', 'ECE'),
  (UUID(), 'Electron Devices Society', 'EDS', 'ECE'),
  (UUID(), 'Control Systems Society', 'CSS', 'EIE'),
  (UUID(), 'Intelligent Transportation Systems Society', 'ITSS', 'CSE');

-- ============================================
-- VIEWS (for dashboard optimization)
-- ============================================
CREATE OR REPLACE VIEW view_society_stats AS
SELECT 
  s.id,
  s.name,
  s.abbreviation,
  COALESCE(SUM(u.activity_points), 0) AS total_points,
  COUNT(u.id) AS total_members
FROM societies s
LEFT JOIN users u ON s.id = u.society_id
GROUP BY s.id, s.name, s.abbreviation;

CREATE OR REPLACE VIEW view_leader_performance AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.activity_points,
  u.primary_skills,
  s.abbreviation AS society_abbreviation,
  COUNT(e.id) AS events_conducted,
  (COALESCE(u.activity_points, 0) + (COUNT(e.id) * 5)) AS total_score
FROM users u
LEFT JOIN societies s ON u.society_id = s.id
LEFT JOIN events e ON u.id = e.organiser_id AND e.status = 'approved'
WHERE u.role IN ('leadership', 'event_manager')
GROUP BY u.id, u.name, u.email, u.role, u.activity_points, u.primary_skills, s.abbreviation;

-- ============================================================================
-- DONE! Schema is ready for IEEE Hub on TiDB Cloud.
-- ============================================================================
