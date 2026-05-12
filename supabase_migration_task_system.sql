-- ============================================================================
-- Task Management System Overhaul — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- 1. Add new columns to existing tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Add check constraint for status (safe approach)
DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('draft', 'approved', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create task_questions table (individual questions with approval workflow)
CREATE TABLE IF NOT EXISTS task_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('mcq', 'coding', 'general')),
  text text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text,
  points integer DEFAULT 10,
  sort_order integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- 3. Create submission_answers table (per-question answers with admin review)
CREATE TABLE IF NOT EXISTS submission_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid REFERENCES task_submissions(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES task_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text text,
  selected_option integer,
  is_correct boolean,
  admin_remarks text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4. Add review_status to task_submissions
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending';

DO $$ BEGIN
  ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_review_status_check
    CHECK (review_status IN ('pending', 'reviewed', 'partial'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_questions_task_id ON task_questions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_questions_status ON task_questions(status);
CREATE INDEX IF NOT EXISTS idx_submission_answers_submission_id ON submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_question_id ON submission_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_event_id ON tasks(event_id);

-- 6. Enable RLS
ALTER TABLE task_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for task_questions

-- Members can read approved questions
CREATE POLICY "Members read approved questions" ON task_questions
  FOR SELECT USING (status = 'approved');

-- Admins can do everything with questions
CREATE POLICY "Admins manage questions" ON task_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_primary')
  );

-- 8. RLS Policies for submission_answers

-- Members can insert their own answers
CREATE POLICY "Members insert answers" ON submission_answers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM task_submissions WHERE id = submission_id AND user_id = auth.uid())
  );

-- Members can read their own answers
CREATE POLICY "Members read own answers" ON submission_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM task_submissions WHERE id = submission_id AND user_id = auth.uid())
  );

-- Admins can read/update/delete all answers (for review)
CREATE POLICY "Admins manage answers" ON submission_answers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin_primary')
  );

-- ============================================================================
-- DONE! After running this, your app will support the new task system.
-- ============================================================================
