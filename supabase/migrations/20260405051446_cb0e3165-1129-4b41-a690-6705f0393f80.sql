
-- 1. Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create user_plants junction table for multi-plant assignment
CREATE TABLE public.user_plants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plant_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, plant_code)
);

-- 3. Add department_id to profiles (nullable for backward compatibility)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);

-- 4. Enable RLS on new tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plants ENABLE ROW LEVEL SECURITY;

-- 5. RLS for departments - everyone can view, admins can manage
CREATE POLICY "Authenticated users can view departments" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. RLS for user_plants - users can view own, admins can manage all
CREATE POLICY "Users can view own plant assignments" ON public.user_plants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all plant assignments" ON public.user_plants
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage plant assignments" ON public.user_plants
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Seed default departments from existing hardcoded list
INSERT INTO public.departments (name, description) VALUES
  ('IT', 'Information Technology'),
  ('Management', 'Senior Management & Executives'),
  ('Quality', 'Quality Assurance & Control'),
  ('Purchase', 'Purchase & Procurement'),
  ('Engineering', 'Engineering & Design'),
  ('Shop Floor', 'Manufacturing & Production'),
  ('MRB Committee', 'Material Review Board Committee')
ON CONFLICT (name) DO NOTHING;

-- 8. Updated_at trigger for departments
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Migrate existing user plant assignments to user_plants table
INSERT INTO public.user_plants (user_id, plant_code)
  SELECT user_id, plant FROM public.profiles WHERE plant IS NOT NULL AND plant != ''
ON CONFLICT (user_id, plant_code) DO NOTHING;
