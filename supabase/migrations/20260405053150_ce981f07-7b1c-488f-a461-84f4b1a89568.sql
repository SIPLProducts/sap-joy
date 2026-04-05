
-- Add plant column to sap_stock_sync_history for per-plant logging
ALTER TABLE public.sap_stock_sync_history ADD COLUMN IF NOT EXISTS plant text;

-- Create scheduler lock table to prevent duplicate runs
CREATE TABLE IF NOT EXISTS public.scheduler_lock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_key text UNIQUE NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- RLS for scheduler_lock (service role only in practice, but allow authenticated for edge functions)
ALTER TABLE public.scheduler_lock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service and admin can manage scheduler locks"
  ON public.scheduler_lock FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Function to acquire scheduler lock (returns true if acquired)
CREATE OR REPLACE FUNCTION public.acquire_scheduler_lock(_lock_key text, _locked_by text DEFAULT 'scheduler')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clean up expired locks first
  DELETE FROM public.scheduler_lock WHERE expires_at < now();
  
  -- Try to insert lock
  BEGIN
    INSERT INTO public.scheduler_lock (lock_key, locked_by, locked_at, expires_at)
    VALUES (_lock_key, _locked_by, now(), now() + interval '10 minutes');
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
END;
$$;

-- Function to release scheduler lock
CREATE OR REPLACE FUNCTION public.release_scheduler_lock(_lock_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.scheduler_lock WHERE lock_key = _lock_key;
$$;
