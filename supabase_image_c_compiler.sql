-- ============================================================================
-- Task System Update: Image Upload & C Compiler Integration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- 1. Add image_url to submission_answers
ALTER TABLE submission_answers ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add c_compiler_enabled to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS c_compiler_enabled boolean DEFAULT false;
