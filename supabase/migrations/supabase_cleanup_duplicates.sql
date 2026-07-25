-- Clean up duplicate tasks: keep only the first task per event, delete the rest
-- Run this in Supabase SQL Editor

-- Step 1: Delete questions for duplicate tasks
DELETE FROM task_questions
WHERE task_id IN (
  SELECT id FROM tasks t
  WHERE EXISTS (
    SELECT 1 FROM tasks t2
    WHERE t2.event_id = t.event_id
    AND t2.created_at < t.created_at
  )
);

-- Step 2: Delete the duplicate tasks themselves (keeps earliest per event)
DELETE FROM tasks t
WHERE EXISTS (
  SELECT 1 FROM tasks t2
  WHERE t2.event_id = t.event_id
  AND t2.created_at < t.created_at
);

-- Verify: should show 1 task per event max
SELECT id, title, event_id, status, created_at FROM tasks ORDER BY created_at;
