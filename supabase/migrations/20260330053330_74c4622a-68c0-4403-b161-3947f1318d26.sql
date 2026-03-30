CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_update_user_password(target_user_id uuid, new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  
  IF length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  IF length(new_password) > 10 THEN
    RAISE EXCEPTION 'Password must be at most 10 characters';
  END IF;

  UPDATE auth.users SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')) WHERE id = target_user_id;
END;
$$;