
-- Step 1: Drop ALL policies that use has_role(uuid, app_role)

DROP POLICY IF EXISTS "Role-based MRB update access" ON public.mrb_records;
DROP POLICY IF EXISTS "Admins can manage dashboard config" ON public.dashboard_config;
DROP POLICY IF EXISTS "Quality and admin can manage defect codes" ON public.defect_codes;
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can manage materials" ON public.materials;
DROP POLICY IF EXISTS "Admins can insert password history" ON public.password_history;
DROP POLICY IF EXISTS "Admins can view password history" ON public.password_history;
DROP POLICY IF EXISTS "Admins can manage print config" ON public.plant_print_config;
DROP POLICY IF EXISTS "Admins can manage workflow config" ON public.plant_workflow_config;
DROP POLICY IF EXISTS "Admins can manage plants" ON public.plants;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage request fields" ON public.sap_api_request_fields;
DROP POLICY IF EXISTS "Admins can manage response fields" ON public.sap_api_response_fields;
DROP POLICY IF EXISTS "Admins can manage plant assignments" ON public.user_plants;
DROP POLICY IF EXISTS "Admins can view all plant assignments" ON public.user_plants;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user security" ON public.user_security;
DROP POLICY IF EXISTS "Admins can manage all security info" ON public.user_security;
DROP POLICY IF EXISTS "Admins can update user security" ON public.user_security;
DROP POLICY IF EXISTS "Purchase and admin can manage vendors" ON public.vendors;
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;

-- Step 2: Drop functions
DROP FUNCTION IF EXISTS public.admin_update_user_password(uuid, text);
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- Step 3: Convert columns
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.mrb_records ALTER COLUMN pending_with TYPE text USING pending_with::text;
ALTER TABLE public.mrb_approval_history ALTER COLUMN performed_by_role TYPE text USING performed_by_role::text;
ALTER TABLE public.plant_workflow_config ALTER COLUMN department TYPE text USING department::text;
ALTER TABLE public.dashboard_config ALTER COLUMN role TYPE text USING role::text;

-- Step 4: Drop enum
DROP TYPE IF EXISTS public.app_role;

-- Step 5: Recreate functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.admin_update_user_password(target_user_id uuid, new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can reset passwords'; END IF;
  IF length(new_password) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;
  IF length(new_password) > 10 THEN RAISE EXCEPTION 'Password must be at most 10 characters'; END IF;
  UPDATE auth.users SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')) WHERE id = target_user_id;
END;
$$;

-- Step 6: Recreate all policies
CREATE POLICY "Admins can manage dashboard config" ON public.dashboard_config FOR ALL TO public USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Quality and admin can manage defect codes" ON public.defect_codes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'quality') OR has_role(auth.uid(), 'quality_head'));
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage email templates" ON public.email_templates FOR ALL TO public USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage materials" ON public.materials FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Role-based MRB update access" ON public.mrb_records FOR UPDATE TO authenticated
USING (
  ((auth.uid() = created_by) AND (status = 'draft'))
  OR (has_role(auth.uid(), 'quality') AND (pending_with = 'quality' OR status IN ('draft', 'quality_review')))
  OR (has_role(auth.uid(), 'quality_head') AND (pending_with = 'quality_head' OR status IN ('draft', 'quality_review', 'final_approval')))
  OR (has_role(auth.uid(), 'purchase') AND (pending_with = 'purchase' OR status = 'purchase_review'))
  OR (has_role(auth.uid(), 'purchase_head') AND (pending_with = 'purchase_head' OR status IN ('purchase_review', 'final_approval')))
  OR (has_role(auth.uid(), 'engineering') AND (pending_with = 'engineering' OR status = 'engineering_review'))
  OR (has_role(auth.uid(), 'engineering_head') AND (pending_with = 'engineering_head' OR status IN ('engineering_review', 'final_approval')))
  OR (has_role(auth.uid(), 'shop_floor') AND status = 'draft' AND auth.uid() = created_by)
  OR (has_role(auth.uid(), 'executive') AND (pending_with = 'executive' OR status = 'final_approval'))
  OR (has_role(auth.uid(), 'mrb_committee') AND pending_with = 'mrb_committee')
  OR has_role(auth.uid(), 'admin')
) WITH CHECK (true);

CREATE POLICY "Admins can insert password history" ON public.password_history FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view password history" ON public.password_history FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage print config" ON public.plant_print_config FOR ALL TO public USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage workflow config" ON public.plant_workflow_config FOR ALL TO public USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage plants" ON public.plants FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage request fields" ON public.sap_api_request_fields FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage response fields" ON public.sap_api_response_fields FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage plant assignments" ON public.user_plants FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all plant assignments" ON public.user_plants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert user security" ON public.user_security FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all security info" ON public.user_security FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update user security" ON public.user_security FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Purchase and admin can manage vendors" ON public.vendors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'purchase') OR has_role(auth.uid(), 'purchase_head'));
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
