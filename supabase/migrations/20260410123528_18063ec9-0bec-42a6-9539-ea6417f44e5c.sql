
-- 1. role_permissions: allow users with role_access to manage
CREATE POLICY "Users with role_access can insert permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_screen_access(auth.uid(), 'role_access'));

CREATE POLICY "Users with role_access can update permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_screen_access(auth.uid(), 'role_access'))
  WITH CHECK (public.has_screen_access(auth.uid(), 'role_access'));

CREATE POLICY "Users with role_access can delete permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_screen_access(auth.uid(), 'role_access'));

-- 2. departments: allow users with role_management
CREATE POLICY "Users with role_management can manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'role_management'))
  WITH CHECK (public.has_screen_access(auth.uid(), 'role_management'));

-- 3. plants: allow users with plant_management
CREATE POLICY "Users with plant_management can manage plants"
  ON public.plants FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'plant_management'))
  WITH CHECK (public.has_screen_access(auth.uid(), 'plant_management'));

-- 4. plant_workflow_config: allow users with workflow_config
CREATE POLICY "Users with workflow_config can manage workflow"
  ON public.plant_workflow_config FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'workflow_config'))
  WITH CHECK (public.has_screen_access(auth.uid(), 'workflow_config'));

-- 5. smtp_config: allow users with email_config
CREATE POLICY "Users with email_config can manage smtp"
  ON public.smtp_config FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'email_config'))
  WITH CHECK (public.has_screen_access(auth.uid(), 'email_config'));

-- 6. email_templates: allow users with email_config
CREATE POLICY "Users with email_config can manage templates"
  ON public.email_templates FOR ALL TO authenticated
  USING (public.has_screen_access(auth.uid(), 'email_config'))
  WITH CHECK (public.has_screen_access(auth.uid(), 'email_config'));

-- 7. profiles: allow users with user_management to update all profiles
CREATE POLICY "Users with user_management can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_screen_access(auth.uid(), 'user_management'));

-- 8. password_history: allow users with user_management to insert
CREATE POLICY "Users with user_management can insert password history"
  ON public.password_history FOR INSERT TO authenticated
  WITH CHECK (public.has_screen_access(auth.uid(), 'user_management'));

-- 9. Update admin_update_user_password to allow user_management permission holders
CREATE OR REPLACE FUNCTION public.admin_update_user_password(target_user_id uuid, new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_screen_access(auth.uid(), 'user_management')) THEN
    RAISE EXCEPTION 'Only users with user management access can reset passwords';
  END IF;
  IF length(new_password) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;
  IF length(new_password) > 10 THEN RAISE EXCEPTION 'Password must be at most 10 characters'; END IF;
  UPDATE auth.users SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')) WHERE id = target_user_id;
END;
$function$;
