-- Drop the existing constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;

-- Create the new constraint including 'ongoing' and 'completed'
ALTER TABLE public.events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'ongoing', 'completed'));
