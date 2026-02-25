
-- Fix mrb_records SELECT policy: drop restrictive, create permissive
DROP POLICY IF EXISTS "Authenticated users can view MRB records" ON public.mrb_records;
CREATE POLICY "Authenticated users can view MRB records"
  ON public.mrb_records FOR SELECT TO authenticated
  USING (true);

-- Fix email_logs SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view email logs" ON public.email_logs;
CREATE POLICY "Authenticated users can view email logs"
  ON public.email_logs FOR SELECT TO authenticated
  USING (true);

-- Fix inward_inspection_lots SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Authenticated users can view inspection lots"
  ON public.inward_inspection_lots FOR SELECT TO authenticated
  USING (true);

-- Fix shop_floor_stock SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view shop floor stock" ON public.shop_floor_stock;
CREATE POLICY "Authenticated users can view shop floor stock"
  ON public.shop_floor_stock FOR SELECT TO authenticated
  USING (true);

-- Fix profiles SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Fix user_roles SELECT policy
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Fix plants SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view plants" ON public.plants;
CREATE POLICY "Authenticated users can view plants"
  ON public.plants FOR SELECT TO authenticated
  USING (true);

-- Fix vendors SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view vendors" ON public.vendors;
CREATE POLICY "Authenticated users can view vendors"
  ON public.vendors FOR SELECT TO authenticated
  USING (true);

-- Fix materials SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view materials" ON public.materials;
CREATE POLICY "Authenticated users can view materials"
  ON public.materials FOR SELECT TO authenticated
  USING (true);

-- Fix defect_codes SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view defect codes" ON public.defect_codes;
CREATE POLICY "Authenticated users can view defect codes"
  ON public.defect_codes FOR SELECT TO authenticated
  USING (true);

-- Fix mrb_approval_history SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view approval history" ON public.mrb_approval_history;
CREATE POLICY "Authenticated users can view approval history"
  ON public.mrb_approval_history FOR SELECT TO authenticated
  USING (true);

-- Fix mrb_attachments SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view MRB attachments" ON public.mrb_attachments;
CREATE POLICY "Authenticated users can view MRB attachments"
  ON public.mrb_attachments FOR SELECT TO authenticated
  USING (true);

-- Fix INSERT policies too
DROP POLICY IF EXISTS "Authenticated users can create MRB records" ON public.mrb_records;
CREATE POLICY "Authenticated users can create MRB records"
  ON public.mrb_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated users can create email logs" ON public.email_logs;
CREATE POLICY "Authenticated users can create email logs"
  ON public.email_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sent_by);

DROP POLICY IF EXISTS "Authenticated users can add approval history" ON public.mrb_approval_history;
CREATE POLICY "Authenticated users can add approval history"
  ON public.mrb_approval_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = performed_by);

DROP POLICY IF EXISTS "Authenticated users can add attachments" ON public.mrb_attachments;
CREATE POLICY "Authenticated users can add attachments"
  ON public.mrb_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Fix UPDATE policies
DROP POLICY IF EXISTS "Role-based MRB update access" ON public.mrb_records;
CREATE POLICY "Role-based MRB update access"
  ON public.mrb_records FOR UPDATE TO authenticated
  USING (
    (auth.uid() = created_by AND status = 'draft') OR
    has_role(auth.uid(), 'quality') AND (pending_with = 'quality' OR status IN ('draft', 'quality_review')) OR
    has_role(auth.uid(), 'quality_head') AND (pending_with = 'quality_head' OR status IN ('draft', 'quality_review', 'final_approval')) OR
    has_role(auth.uid(), 'purchase') AND (pending_with = 'purchase' OR status = 'purchase_review') OR
    has_role(auth.uid(), 'purchase_head') AND (pending_with = 'purchase_head' OR status IN ('purchase_review', 'final_approval')) OR
    has_role(auth.uid(), 'engineering') AND (pending_with = 'engineering' OR status = 'engineering_review') OR
    has_role(auth.uid(), 'engineering_head') AND (pending_with = 'engineering_head' OR status IN ('engineering_review', 'final_approval')) OR
    has_role(auth.uid(), 'shop_floor') AND status = 'draft' AND auth.uid() = created_by OR
    has_role(auth.uid(), 'executive') AND (pending_with = 'executive' OR status = 'final_approval') OR
    has_role(auth.uid(), 'mrb_committee') AND pending_with = 'mrb_committee' OR
    has_role(auth.uid(), 'admin')
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Fix remaining INSERT/UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can insert inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Authenticated users can insert inspection lots"
  ON public.inward_inspection_lots FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Authenticated users can update inspection lots"
  ON public.inward_inspection_lots FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete inspection lots" ON public.inward_inspection_lots;
CREATE POLICY "Authenticated users can delete inspection lots"
  ON public.inward_inspection_lots FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert shop floor stock" ON public.shop_floor_stock;
CREATE POLICY "Authenticated users can insert shop floor stock"
  ON public.shop_floor_stock FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update shop floor stock" ON public.shop_floor_stock;
CREATE POLICY "Authenticated users can update shop floor stock"
  ON public.shop_floor_stock FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Uploaders can delete their attachments" ON public.mrb_attachments;
CREATE POLICY "Uploaders can delete their attachments"
  ON public.mrb_attachments FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Authenticated users can insert sync history" ON public.sap_stock_sync_history;
CREATE POLICY "Authenticated users can insert sync history"
  ON public.sap_stock_sync_history FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update sync history" ON public.sap_stock_sync_history;
CREATE POLICY "Authenticated users can update sync history"
  ON public.sap_stock_sync_history FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view sync history" ON public.sap_stock_sync_history;
CREATE POLICY "Authenticated users can view sync history"
  ON public.sap_stock_sync_history FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create SAP sync history" ON public.sap_sync_history;
CREATE POLICY "Authenticated users can create SAP sync history"
  ON public.sap_sync_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view all SAP sync history" ON public.sap_sync_history;
CREATE POLICY "Users can view all SAP sync history"
  ON public.sap_sync_history FOR SELECT TO authenticated
  USING (true);
