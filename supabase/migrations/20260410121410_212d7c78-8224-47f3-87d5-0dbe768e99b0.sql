
-- Step 1: Create security definer function to check screen access
CREATE OR REPLACE FUNCTION public.has_screen_access(_user_id uuid, _screen_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.module_key = _screen_key
      AND rp.can_view = true
  )
$$;

-- Step 2: Add RLS policies for user_roles
CREATE POLICY "Users with user_management can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));

CREATE POLICY "Users with user_management can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));

-- Step 3: Add RLS policies for user_plants
CREATE POLICY "Users with user_management can view all plant assignments"
  ON public.user_plants FOR SELECT
  TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));

CREATE POLICY "Users with user_management can manage all plant assignments"
  ON public.user_plants FOR ALL
  TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));

-- Step 4: Add RLS policies for user_security
CREATE POLICY "Users with user_management can view all security info"
  ON public.user_security FOR SELECT
  TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));

CREATE POLICY "Users with user_management can manage all security info"
  ON public.user_security FOR ALL
  TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));

-- Step 5: Add RLS policy for password_history
CREATE POLICY "Users with user_management can view password history"
  ON public.password_history FOR SELECT
  TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));
