-- Fix: Allow 'general' type in tasks table
-- Run this in Supabase SQL Editor

-- Drop old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Add updated constraint with 'general' included
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check 
  CHECK (type IN ('mcq', 'coding', 'general'));
