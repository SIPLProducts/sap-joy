
-- =====================================================
-- COMPLETE CONSOLIDATED MIGRATION (fixed)
-- All triggers, RLS policies, storage, constraints
-- =====================================================

-- 1. TRIGGER: handle_new_user (auto-create profile on signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. TRIGGERS: updated_at auto-update on all relevant tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_mrb_records_updated_at ON public.mrb_records;
CREATE TRIGGER update_mrb_records_updated_at
  BEFORE UPDATE ON public.mrb_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_materials_updated_at ON public.materials;
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendors_updated_at ON public.vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sap_api_config_updated_at ON public.sap_api_config;
CREATE TRIGGER update_sap_api_config_updated_at
  BEFORE UPDATE ON public.sap_api_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_inward_inspection_lots_updated_at ON public.inward_inspection_lots;
CREATE TRIGGER update_inward_inspection_lots_updated_at
  BEFORE UPDATE ON public.inward_inspection_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_floor_stock_updated_at ON public.shop_floor_stock;
CREATE TRIGGER update_shop_floor_stock_updated_at
  BEFORE UPDATE ON public.shop_floor_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_plant_print_config_updated_at ON public.plant_print_config;
CREATE TRIGGER update_plant_print_config_updated_at
  BEFORE UPDATE ON public.plant_print_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS: Allow authenticated profile inserts (for signup flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Service role can insert profiles'
  ) THEN
    CREATE POLICY "Service role can insert profiles"
      ON public.profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. RLS: Allow admins to update any profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- 5. Storage: Ensure inward-uploads bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('inward-uploads', 'inward-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS policies for inward-uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload inward files'
  ) THEN
    CREATE POLICY "Authenticated users can upload inward files"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'inward-uploads');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can view inward files'
  ) THEN
    CREATE POLICY "Authenticated users can view inward files"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'inward-uploads');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete inward files'
  ) THEN
    CREATE POLICY "Authenticated users can delete inward files"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'inward-uploads');
  END IF;
END $$;

-- 7. Unique constraint on user_roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;
