
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'quality_engineer',
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'conditional', 'pending', 'disqualified')),
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  certification_type TEXT,
  certification_expiry DATE,
  last_audit_date DATE,
  next_audit_date DATE,
  defect_rate NUMERIC(5,2) DEFAULT 0,
  on_time_delivery NUMERIC(5,2) DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own suppliers" ON public.suppliers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own suppliers" ON public.suppliers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Parts table
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  part_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  risk_class TEXT DEFAULT 'II' CHECK (risk_class IN ('I', 'II', 'III')),
  fda_clearance TEXT,
  unit_cost NUMERIC(10,2),
  specifications JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own parts" ON public.parts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert parts" ON public.parts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own parts" ON public.parts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own parts" ON public.parts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lots table
CREATE TABLE public.lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lot_number TEXT NOT NULL,
  part_id UUID REFERENCES public.parts(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE,
  status TEXT NOT NULL DEFAULT 'quarantine' CHECK (status IN ('approved', 'quarantine', 'rejected', 'recalled')),
  inspection_status TEXT DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'passed', 'failed', 'partial')),
  certificate_of_conformance TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own lots" ON public.lots FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert lots" ON public.lots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lots" ON public.lots FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lots" ON public.lots FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_lots_updated_at BEFORE UPDATE ON public.lots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Devices table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  serial_number TEXT NOT NULL,
  name TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'in_production' CHECK (status IN ('in_production', 'released', 'recalled', 'quarantined')),
  production_date DATE,
  release_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own devices" ON public.devices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert devices" ON public.devices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own devices" ON public.devices FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own devices" ON public.devices FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Device-Lot junction (which lots went into which devices)
CREATE TABLE public.device_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  lot_id UUID REFERENCES public.lots(id) ON DELETE CASCADE NOT NULL,
  quantity_used INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, lot_id)
);
ALTER TABLE public.device_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view device_lots" ON public.device_lots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.user_id = auth.uid()));
CREATE POLICY "Users can insert device_lots" ON public.device_lots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.user_id = auth.uid()));
CREATE POLICY "Users can delete device_lots" ON public.device_lots FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.user_id = auth.uid()));

-- Inspections table
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lot_id UUID REFERENCES public.lots(id) ON DELETE SET NULL,
  inspection_type TEXT NOT NULL DEFAULT 'incoming' CHECK (inspection_type IN ('incoming', 'in_process', 'final', 'requalification')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'partial')),
  inspector_name TEXT,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sample_size INTEGER,
  defects_found INTEGER DEFAULT 0,
  measurements JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own inspections" ON public.inspections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert inspections" ON public.inspections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inspections" ON public.inspections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inspections" ON public.inspections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- NCRs table
CREATE TABLE public.ncrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ncr_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  lot_id UUID REFERENCES public.lots(id) ON DELETE SET NULL,
  part_id UUID REFERENCES public.parts(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('critical', 'major', 'minor')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'disposition', 'closed')),
  disposition TEXT CHECK (disposition IN ('use_as_is', 'rework', 'scrap', 'return_to_supplier', NULL)),
  root_cause TEXT,
  corrective_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ncrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ncrs" ON public.ncrs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert ncrs" ON public.ncrs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ncrs" ON public.ncrs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ncrs" ON public.ncrs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_ncrs_updated_at BEFORE UPDATE ON public.ncrs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CAPAs table
CREATE TABLE public.capas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  capa_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'corrective' CHECK (type IN ('corrective', 'preventive')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigation', 'implementation', 'verification', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  ncr_id UUID REFERENCES public.ncrs(id) ON DELETE SET NULL,
  root_cause TEXT,
  action_plan TEXT,
  assigned_to TEXT,
  due_date DATE,
  completed_date DATE,
  effectiveness_check TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.capas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own capas" ON public.capas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert capas" ON public.capas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own capas" ON public.capas FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own capas" ON public.capas FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_capas_updated_at BEFORE UPDATE ON public.capas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('sop', 'spec', 'certificate', 'inspection_report', 'batch_record', 'ncr_report', 'capa_report', 'other')),
  version TEXT DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'obsolete')),
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  linked_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  linked_lot_id UUID REFERENCES public.lots(id) ON DELETE SET NULL,
  linked_ncr_id UUID REFERENCES public.ncrs(id) ON DELETE SET NULL,
  extracted_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
CREATE POLICY "Users can upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
