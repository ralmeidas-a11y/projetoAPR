-- EMERGENCY: Disable RLS to test access
-- Description: Disables RLS temporarily to verify if recursion is the cause of infinite loading.

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;

-- If you want to keep RLS but fix it, run the script from Step 491 again.
-- But for now, let's keep it DISABLED for 5 minutes of testing.
