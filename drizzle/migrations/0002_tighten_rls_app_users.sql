-- Helper: a signed-in user is an "app user" only if an administrator assigned them a role.
CREATE OR REPLACE FUNCTION public.is_app_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_app_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_user(uuid) TO authenticated, service_role;

-- scheduler_lock: only managed via security-definer lock functions / service role
DROP POLICY IF EXISTS "Service and admin can manage scheduler locks" ON public.scheduler_lock;
CREATE POLICY "Admins can manage scheduler locks" ON public.scheduler_lock
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reference/config tables: readable only by provisioned app users
DROP POLICY IF EXISTS "Authenticated users can view request fields" ON public.sap_api_request_fields;
CREATE POLICY "App users can view request fields" ON public.sap_api_request_fields
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view response fields" ON public.sap_api_response_fields;
CREATE POLICY "App users can view response fields" ON public.sap_api_response_fields
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view role_permissions" ON public.role_permissions;
CREATE POLICY "App users can view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view vendors" ON public.vendors;
CREATE POLICY "App users can view vendors" ON public.vendors
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view defect codes" ON public.defect_codes;
CREATE POLICY "App users can view defect codes" ON public.defect_codes
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view materials" ON public.materials;
CREATE POLICY "App users can view materials" ON public.materials
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view email templates" ON public.email_templates;
CREATE POLICY "App users can view email templates" ON public.email_templates
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view print config" ON public.plant_print_config;
CREATE POLICY "App users can view print config" ON public.plant_print_config
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view dashboard config" ON public.dashboard_config;
CREATE POLICY "App users can view dashboard config" ON public.dashboard_config
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view departments" ON public.departments;
CREATE POLICY "App users can view departments" ON public.departments
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view workflow config" ON public.plant_workflow_config;
CREATE POLICY "App users can view workflow config" ON public.plant_workflow_config
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));

-- profiles: own profile always, everyone else's only for provisioned users
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Users view own profile or app users view all" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_app_user(auth.uid()));

-- quality_info: plant scoped
DROP POLICY IF EXISTS "Authenticated can view quality_info" ON public.quality_info;
CREATE POLICY "Users view quality_info for assigned plants" ON public.quality_info
  FOR SELECT TO authenticated
  USING (public.is_app_user(auth.uid()) AND public.user_has_plant(auth.uid(), plant));

-- Inspection lot / in-process report deletes: plant scoped
DROP POLICY IF EXISTS "Authenticated users can delete inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Users delete inspection lots for assigned plants" ON public.inward_inspection_lots
  FOR DELETE TO authenticated
  USING (public.is_app_user(auth.uid()) AND public.user_has_plant(auth.uid(), plant));

DROP POLICY IF EXISTS "Authenticated users can delete zmrb inward report" ON public.zmrb_inward_report;
CREATE POLICY "Users delete zmrb inward report for assigned plants" ON public.zmrb_inward_report
  FOR DELETE TO authenticated
  USING (public.is_app_user(auth.uid()) AND public.user_has_plant(auth.uid(), plant));

-- mrb_alert_recipients: scoped to MRBs in the user's plants
DROP POLICY IF EXISTS "Auth read alert recipients" ON public.mrb_alert_recipients;
DROP POLICY IF EXISTS "Auth insert alert recipients" ON public.mrb_alert_recipients;
DROP POLICY IF EXISTS "Auth delete alert recipients" ON public.mrb_alert_recipients;
CREATE POLICY "Users read alert recipients for assigned-plant MRBs" ON public.mrb_alert_recipients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mrb_records m WHERE m.id = mrb_alert_recipients.mrb_id AND public.user_has_plant(auth.uid(), m.plant)));
CREATE POLICY "Users add alert recipients for assigned-plant MRBs" ON public.mrb_alert_recipients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_user(auth.uid()) AND EXISTS (SELECT 1 FROM public.mrb_records m WHERE m.id = mrb_alert_recipients.mrb_id AND public.user_has_plant(auth.uid(), m.plant)));
CREATE POLICY "Creators or admins delete alert recipients" ON public.mrb_alert_recipients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.mrb_records m WHERE m.id = mrb_alert_recipients.mrb_id AND m.created_by = auth.uid()));

-- SAP stock sync history
DROP POLICY IF EXISTS "Authenticated users can view sync history" ON public.sap_stock_sync_history;
DROP POLICY IF EXISTS "Authenticated users can insert sync history" ON public.sap_stock_sync_history;
DROP POLICY IF EXISTS "Authenticated users can update sync history" ON public.sap_stock_sync_history;
CREATE POLICY "App users can view sync history" ON public.sap_stock_sync_history
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));
CREATE POLICY "App users can insert sync history" ON public.sap_stock_sync_history
  FOR INSERT TO authenticated WITH CHECK (public.is_app_user(auth.uid()));
CREATE POLICY "App users can update sync history" ON public.sap_stock_sync_history
  FOR UPDATE TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));

-- SAP MRB sync history
DROP POLICY IF EXISTS "Users can view all SAP sync history" ON public.sap_sync_history;
DROP POLICY IF EXISTS "Authenticated users can create SAP sync history" ON public.sap_sync_history;
CREATE POLICY "Users view SAP sync history for assigned-plant MRBs" ON public.sap_sync_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mrb_records m WHERE m.id = sap_sync_history.mrb_id AND public.user_has_plant(auth.uid(), m.plant)));
CREATE POLICY "App users create SAP sync history for assigned-plant MRBs" ON public.sap_sync_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_user(auth.uid()) AND EXISTS (SELECT 1 FROM public.mrb_records m WHERE m.id = sap_sync_history.mrb_id AND public.user_has_plant(auth.uid(), m.plant)));

-- email_logs: scoped to MRBs in the user's plants
DROP POLICY IF EXISTS "Authenticated users can view email logs" ON public.email_logs;
CREATE POLICY "Users view email logs for assigned-plant MRBs" ON public.email_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mrb_records m WHERE m.id = email_logs.mrb_id AND public.user_has_plant(auth.uid(), m.plant)));

-- smtp_config: credentials only for admins / email-config users (existing ALL policies cover their reads)
DROP POLICY IF EXISTS "Authenticated users can view smtp config" ON public.smtp_config;

-- sap_api_config: was fully open (including signed-out callers)
DROP POLICY IF EXISTS "All authenticated users can manage SAP config" ON public.sap_api_config;
DROP POLICY IF EXISTS "All authenticated users can view SAP config" ON public.sap_api_config;
CREATE POLICY "App users can view SAP config" ON public.sap_api_config
  FOR SELECT TO authenticated USING (public.is_app_user(auth.uid()));
CREATE POLICY "App users can update SAP config sync status" ON public.sap_api_config
  FOR UPDATE TO authenticated
  USING (public.is_app_user(auth.uid()))
  WITH CHECK (public.is_app_user(auth.uid()));
CREATE POLICY "SAP settings users can add SAP config" ON public.sap_api_config
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_screen_access(auth.uid(), 'sap_api_settings'));
CREATE POLICY "SAP settings users can delete SAP config" ON public.sap_api_config
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_screen_access(auth.uid(), 'sap_api_settings'));
REVOKE ALL ON public.sap_api_config FROM anon;
REVOKE ALL ON public.smtp_config FROM anon;
REVOKE ALL ON public.scheduler_lock FROM anon;

-- Storage: inward-uploads files tied to their uploader
DROP POLICY IF EXISTS "Authenticated users can upload inward files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view inward files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete inward files" ON storage.objects;
CREATE POLICY "Users upload own inward files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inward-uploads' AND owner_id = (SELECT auth.uid()::text) AND public.is_app_user(auth.uid()));
CREATE POLICY "Users view own inward files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inward-uploads' AND owner_id = (SELECT auth.uid()::text));
CREATE POLICY "Users delete own inward files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inward-uploads' AND owner_id = (SELECT auth.uid()::text));