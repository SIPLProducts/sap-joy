
-- Password history table to track last N passwords
CREATE TABLE public.password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage password history"
  ON public.password_history
  FOR ALL
  TO authenticated
  USING (false);

-- User security table for failed attempts, lockout, password expiry
CREATE TABLE public.user_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  last_password_change timestamp with time zone DEFAULT now(),
  password_expiry_days integer NOT NULL DEFAULT 45,
  max_failed_attempts integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security info"
  ON public.user_security
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all security info"
  ON public.user_security
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to check password policy (reuse, expiry, lockout)
CREATE OR REPLACE FUNCTION public.check_login_security(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sec_record record;
  result jsonb;
BEGIN
  SELECT * INTO sec_record FROM public.user_security WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    -- Auto-create security record
    INSERT INTO public.user_security (user_id) VALUES (_user_id);
    RETURN jsonb_build_object('locked', false, 'password_expired', false, 'days_until_expiry', 45);
  END IF;
  
  -- Check lockout
  IF sec_record.locked_until IS NOT NULL AND sec_record.locked_until > now() THEN
    RETURN jsonb_build_object(
      'locked', true, 
      'locked_until', sec_record.locked_until,
      'password_expired', false
    );
  END IF;
  
  -- Check password expiry
  DECLARE
    days_since_change integer;
    is_expired boolean;
  BEGIN
    days_since_change := EXTRACT(DAY FROM (now() - COALESCE(sec_record.last_password_change, sec_record.created_at)));
    is_expired := days_since_change >= sec_record.password_expiry_days;
    
    RETURN jsonb_build_object(
      'locked', false,
      'password_expired', is_expired,
      'days_until_expiry', GREATEST(0, sec_record.password_expiry_days - days_since_change),
      'failed_attempts', sec_record.failed_login_attempts
    );
  END;
END;
$$;

-- Function to record failed login attempt
CREATE OR REPLACE FUNCTION public.record_failed_login(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sec_record record;
  new_attempts integer;
BEGIN
  SELECT * INTO sec_record FROM public.user_security WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.user_security (user_id, failed_login_attempts) VALUES (_user_id, 1);
    RETURN jsonb_build_object('locked', false, 'attempts', 1);
  END IF;
  
  new_attempts := sec_record.failed_login_attempts + 1;
  
  IF new_attempts >= sec_record.max_failed_attempts THEN
    UPDATE public.user_security 
    SET failed_login_attempts = new_attempts, 
        locked_until = now() + interval '30 minutes',
        updated_at = now()
    WHERE user_id = _user_id;
    RETURN jsonb_build_object('locked', true, 'attempts', new_attempts, 'locked_until', now() + interval '30 minutes');
  ELSE
    UPDATE public.user_security 
    SET failed_login_attempts = new_attempts, updated_at = now()
    WHERE user_id = _user_id;
    RETURN jsonb_build_object('locked', false, 'attempts', new_attempts);
  END IF;
END;
$$;

-- Function to reset failed attempts on successful login
CREATE OR REPLACE FUNCTION public.reset_failed_login(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_security (user_id, failed_login_attempts, locked_until)
  VALUES (_user_id, 0, NULL)
  ON CONFLICT (user_id) DO UPDATE SET 
    failed_login_attempts = 0, 
    locked_until = NULL,
    updated_at = now();
END;
$$;

-- Function to check password reuse (last 4 passwords)
CREATE OR REPLACE FUNCTION public.check_password_reuse(_user_id uuid, _new_password_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.password_history
    WHERE user_id = _user_id AND password_hash = _new_password_hash
    ORDER BY changed_at DESC
    LIMIT 4
  );
END;
$$;

-- Function to record password change
CREATE OR REPLACE FUNCTION public.record_password_change(_user_id uuid, _password_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert new password history
  INSERT INTO public.password_history (user_id, password_hash) VALUES (_user_id, _password_hash);
  
  -- Keep only last 4 passwords (for reuse check)
  DELETE FROM public.password_history 
  WHERE user_id = _user_id 
  AND id NOT IN (
    SELECT id FROM public.password_history 
    WHERE user_id = _user_id 
    ORDER BY changed_at DESC 
    LIMIT 4
  );
  
  -- Update last password change date
  INSERT INTO public.user_security (user_id, last_password_change)
  VALUES (_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET 
    last_password_change = now(),
    updated_at = now();
END;
$$;
