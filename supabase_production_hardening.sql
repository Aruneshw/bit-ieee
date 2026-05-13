-- ============================================================================
-- Production Hardening: Task System for 500+ Users
-- Run this in Supabase SQL Editor (AFTER the initial migration)
-- ============================================================================

-- 1. Fix type constraint to include 'general'
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check
  CHECK (type IN ('mcq', 'coding', 'general'));

-- 2. UNIQUE constraint: only ONE task per event (prevents duplicates)
DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_event_id_unique UNIQUE (event_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. UNIQUE constraint: only ONE submission per user per task (prevents duplicates)
DO $$ BEGIN
  ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_user_task_unique
    UNIQUE (user_id, task_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. UNIQUE constraint: only ONE answer per submission per question
DO $$ BEGIN
  ALTER TABLE submission_answers ADD CONSTRAINT submission_answers_sub_q_unique
    UNIQUE (submission_id, question_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Performance indexes for 500+ users
CREATE INDEX IF NOT EXISTS idx_event_bookings_user_id ON event_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_event_bookings_event_id ON event_bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_society_id ON events(society_id);

-- Composite indexes for frequent query patterns
CREATE INDEX IF NOT EXISTS idx_task_questions_task_status ON task_questions(task_id, status);
CREATE INDEX IF NOT EXISTS idx_submission_answers_submission ON submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_task ON task_submissions(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_event_bookings_user_event ON event_bookings(user_id, event_id);

-- 6. Clean up duplicate tasks (keep earliest per event)
DELETE FROM task_questions
WHERE task_id IN (
  SELECT id FROM tasks t
  WHERE EXISTS (
    SELECT 1 FROM tasks t2
    WHERE t2.event_id = t.event_id
    AND t2.created_at < t.created_at
  )
);

DELETE FROM tasks t
WHERE EXISTS (
  SELECT 1 FROM tasks t2
  WHERE t2.event_id = t.event_id
  AND t2.created_at < t.created_at
);

-- 7. Ensure RLS is enabled on all critical tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;

-- 8. RLS for tasks table
DROP POLICY IF EXISTS "Anyone can read approved tasks" ON tasks;
CREATE POLICY "Anyone can read approved tasks" ON tasks
  FOR SELECT USING (status = 'approved' OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_primary')
  );

DROP POLICY IF EXISTS "Admins manage tasks" ON tasks;
CREATE POLICY "Admins manage tasks" ON tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_primary')
  );

-- 9. RLS for task_submissions
DROP POLICY IF EXISTS "Members manage own submissions" ON task_submissions;
CREATE POLICY "Members manage own submissions" ON task_submissions
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all submissions" ON task_submissions;
CREATE POLICY "Admins read all submissions" ON task_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_primary')
  );

-- 10. Verify setup
SELECT 'Tasks per event:' as check_type, event_id, count(*) as count
FROM tasks GROUP BY event_id HAVING count(*) > 1;

SELECT 'Total tasks:' as info, count(*) FROM tasks;
SELECT 'Total questions:' as info, count(*) FROM task_questions;
SELECT 'Total submissions:' as info, count(*) FROM task_submissions;

-- ============================================================================
-- DONE! Your database is now hardened for 500+ concurrent users.
-- ============================================================================
