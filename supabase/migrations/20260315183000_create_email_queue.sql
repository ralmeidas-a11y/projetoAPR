-- Create the email_queue table
CREATE TABLE public.email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- Secure it with RLS (only service_role can access via functions, but we can also allow authenticated users to insert if needed)
-- However, since enqueue-email is an edge function using anon key and user auth header, we might need a policy, OR we can just use the service_role key in the edge function.
-- Let's stick to using service_role in the edge function for inserting, or create an insert policy.
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- If we want enqueue-email (using anon key + auth) to insert, we can add:
CREATE POLICY "Allow authenticated users to enqueue emails" ON public.email_queue
    FOR INSERT TO authenticated WITH CHECK (true);

-- Create a stored procedure to get and lock emails for safe concurrency
CREATE OR REPLACE FUNCTION get_and_lock_email_batch(batch_size INT)
RETURNS TABLE (
    id UUID,
    recipient_email TEXT,
    subject TEXT,
    html_content TEXT,
    attempt_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH popped AS (
        SELECT q.id
        FROM public.email_queue q
        WHERE q.status = 'pending'
        ORDER BY q.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT batch_size
    )
    UPDATE public.email_queue
    SET status = 'processing'
    WHERE public.email_queue.id IN (SELECT popped.id FROM popped)
    RETURNING public.email_queue.id, public.email_queue.recipient_email, public.email_queue.subject, public.email_queue.html_content, public.email_queue.attempt_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
