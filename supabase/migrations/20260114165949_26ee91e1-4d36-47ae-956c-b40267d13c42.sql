-- Create enum for HBL user roles (excluding plant_head as requested)
CREATE TYPE public.app_role AS ENUM (
  'quality',
  'quality_head',
  'purchase',
  'purchase_head',
  'engineering',
  'engineering_head',
  'shop_floor',
  'executive',
  'admin'
);

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  employee_id TEXT,
  plant TEXT DEFAULT 'Plant-1000',
  department TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create MRB status enum
CREATE TYPE public.mrb_status AS ENUM (
  'draft',
  'quality_review',
  'purchase_review',
  'engineering_review',
  'final_approval',
  'approved',
  'rejected',
  'closed'
);

-- Create MRB source enum
CREATE TYPE public.mrb_source AS ENUM (
  'quality_inspection',
  'shop_floor'
);

-- Create quality decision enum
CREATE TYPE public.quality_decision AS ENUM (
  'accept',
  'reject',
  'partial_accept',
  'blocked'
);

-- Create engineering decision enum
CREATE TYPE public.engineering_decision AS ENUM (
  'use_as_is',
  'use_with_deviation',
  'rework_required',
  'return_to_vendor',
  'scrap_material'
);

-- Create defect category enum
CREATE TYPE public.defect_category AS ENUM (
  'dimensional',
  'surface',
  'material',
  'functional',
  'documentation',
  'packaging',
  'other'
);

-- Create SLA status enum
CREATE TYPE public.sla_status AS ENUM ('green', 'yellow', 'red');

-- Create escalation level enum
CREATE TYPE public.escalation_level AS ENUM ('none', 'L1', 'L2', 'L3');

-- Create plants table
CREATE TABLE public.plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create materials table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_number TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  uom TEXT DEFAULT 'EA',
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create defect_codes table
CREATE TABLE public.defect_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  category defect_category,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create MRB records table
CREATE TABLE public.mrb_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrb_number TEXT UNIQUE NOT NULL,
  status mrb_status NOT NULL DEFAULT 'draft',
  source mrb_source NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pending_with app_role,
  pending_days INTEGER DEFAULT 0,
  sla_status sla_status DEFAULT 'green',
  escalation_level escalation_level DEFAULT 'none',
  
  -- Material Info
  material_id UUID REFERENCES public.materials(id),
  material_number TEXT NOT NULL,
  material_description TEXT NOT NULL,
  plant_id UUID REFERENCES public.plants(id),
  plant TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  vendor_code TEXT,
  vendor_name TEXT,
  
  -- GRN/Inspection Info
  grn_number TEXT,
  inspection_lot TEXT,
  po_number TEXT,
  
  -- Quantities
  total_quantity NUMERIC NOT NULL DEFAULT 0,
  accepted_quantity NUMERIC DEFAULT 0,
  rejected_quantity NUMERIC DEFAULT 0,
  blocked_quantity NUMERIC DEFAULT 0,
  uom TEXT DEFAULT 'EA',
  
  -- Quality Stage
  quality_decision quality_decision,
  defect_category defect_category,
  defect_code TEXT,
  defect_description TEXT,
  quality_remarks TEXT,
  quality_approved_by UUID REFERENCES auth.users(id),
  quality_approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Purchase Stage
  vendor_responsibility TEXT,
  purchase_action TEXT,
  vendor_replacement_required BOOLEAN DEFAULT false,
  expected_replacement_date DATE,
  purchase_remarks TEXT,
  purchase_approved_by UUID REFERENCES auth.users(id),
  purchase_approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Engineering Stage
  engineering_decision engineering_decision,
  engineering_remarks TEXT,
  technical_reference_number TEXT,
  engineering_approved_by UUID REFERENCES auth.users(id),
  engineering_approved_at TIMESTAMP WITH TIME ZONE,
  
  -- Final Approval Stage
  final_decision TEXT,
  final_approved_quantity NUMERIC,
  final_rejected_quantity NUMERIC,
  deviation_approval_number TEXT,
  deviation_validity_date DATE,
  final_remarks TEXT,
  final_approved_by UUID REFERENCES auth.users(id),
  final_approved_at TIMESTAMP WITH TIME ZONE,
  
  -- SAP Posting
  sap_stock_update_status TEXT DEFAULT 'pending',
  return_delivery_number TEXT,
  rework_order_number TEXT,
  scrap_document_number TEXT,
  
  -- Closure
  closure_status TEXT DEFAULT 'open',
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES auth.users(id),
  
  -- Shop Floor Specific
  production_order_number TEXT,
  issued_quantity NUMERIC,
  issue_identified_by TEXT,
  issue_identified_date DATE,
  issue_description TEXT,
  impact_on_production TEXT,
  immediate_block_required BOOLEAN DEFAULT false,
  deviation_requested BOOLEAN DEFAULT false
);

-- Create MRB attachments table
CREATE TABLE public.mrb_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrb_id UUID REFERENCES public.mrb_records(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  category TEXT NOT NULL
);

-- Create MRB approval history table
CREATE TABLE public.mrb_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrb_id UUID REFERENCES public.mrb_records(id) ON DELETE CASCADE NOT NULL,
  stage TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  performed_by_role app_role NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  remarks TEXT
);

-- Create email logs table
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrb_id UUID REFERENCES public.mrb_records(id) ON DELETE CASCADE NOT NULL,
  mrb_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  recipients TEXT[] NOT NULL,
  cc TEXT[],
  template TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending',
  body TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrb_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrb_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrb_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mrb_records_updated_at
  BEFORE UPDATE ON public.mrb_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_roles (read-only for users, admin can manage)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for plants (read for all authenticated)
CREATE POLICY "Authenticated users can view plants"
  ON public.plants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage plants"
  ON public.plants FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for vendors (read for all authenticated)
CREATE POLICY "Authenticated users can view vendors"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Purchase and admin can manage vendors"
  ON public.vendors FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'purchase') OR
    public.has_role(auth.uid(), 'purchase_head')
  );

-- RLS Policies for materials (read for all authenticated)
CREATE POLICY "Authenticated users can view materials"
  ON public.materials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage materials"
  ON public.materials FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for defect_codes (read for all authenticated)
CREATE POLICY "Authenticated users can view defect codes"
  ON public.defect_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Quality and admin can manage defect codes"
  ON public.defect_codes FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'quality') OR
    public.has_role(auth.uid(), 'quality_head')
  );

-- RLS Policies for mrb_records
CREATE POLICY "Authenticated users can view MRB records"
  ON public.mrb_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create MRB records"
  ON public.mrb_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authorized users can update MRB records"
  ON public.mrb_records FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for mrb_attachments
CREATE POLICY "Authenticated users can view MRB attachments"
  ON public.mrb_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can add attachments"
  ON public.mrb_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders can delete their attachments"
  ON public.mrb_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- RLS Policies for mrb_approval_history
CREATE POLICY "Authenticated users can view approval history"
  ON public.mrb_approval_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can add approval history"
  ON public.mrb_approval_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = performed_by);

-- RLS Policies for email_logs
CREATE POLICY "Authenticated users can view email logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create email logs"
  ON public.email_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sent_by);