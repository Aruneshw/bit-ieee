-- ============================================================================
-- Task System Update: Admin Question Image Upload
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- Add image_url to task_questions so admins can attach images to questions
ALTER TABLE task_questions ADD COLUMN IF NOT EXISTS image_url text;
