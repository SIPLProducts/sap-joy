
-- Fill existing NULL employee_ids with email prefix
UPDATE public.profiles SET employee_id = split_part(email, '@', 1) WHERE employee_id IS NULL OR employee_id = '';

-- Make employee_id NOT NULL
ALTER TABLE public.profiles ALTER COLUMN employee_id SET NOT NULL;

-- Add unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_id ON public.profiles(employee_id);

-- Update handle_new_user trigger to include employee_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, employee_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'employee_id', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$function$;
