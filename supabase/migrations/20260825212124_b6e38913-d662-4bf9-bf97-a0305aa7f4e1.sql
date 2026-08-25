CREATE TYPE public.app_role AS ENUM ('admin', 'analyst');
CREATE TYPE public.batch_status AS ENUM ('validating', 'queued', 'processing', 'completed', 'partial', 'failed');
CREATE TYPE public.item_status AS ENUM ('queued', 'processing', 'completed', 'failed');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'analyst',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.analysis_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  status public.batch_status NOT NULL DEFAULT 'validating',
  total_files integer NOT NULL DEFAULT 0 CHECK (total_files >= 0),
  completed_files integer NOT NULL DEFAULT 0 CHECK (completed_files >= 0),
  failed_files integer NOT NULL DEFAULT 0 CHECK (failed_files >= 0),
  audio_seconds double precision NOT NULL DEFAULT 0 CHECK (audio_seconds >= 0),
  processing_ms integer NOT NULL DEFAULT 0 CHECK (processing_ms >= 0),
  estimated_cost_usd numeric(12,8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_batches TO authenticated;
GRANT ALL ON public.analysis_batches TO service_role;
ALTER TABLE public.analysis_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage batches" ON public.analysis_batches FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.analysis_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.analysis_batches(id) ON DELETE CASCADE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  storage_path text,
  status public.item_status NOT NULL DEFAULT 'queued',
  emotional_tone text CHECK (emotional_tone IN ('neutral','satisfied','frustrated','upset','distressed')),
  emotional_intensity text CHECK (emotional_intensity IN ('low','medium','high')),
  background_noise_present boolean,
  background_noise_type text,
  background_noise_severity text CHECK (background_noise_severity IN ('none','low','medium','high')),
  audio_quality text CHECK (audio_quality IN ('clear','slightly_impaired','severely_impaired')),
  speaker_overlap_present boolean,
  long_silence_present boolean,
  confidence double precision CHECK (confidence BETWEEN 0 AND 1),
  field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage_used text,
  duration_seconds double precision CHECK (duration_seconds >= 0),
  processing_ms integer CHECK (processing_ms >= 0),
  error_message text,
  expected_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, file_name),
  CHECK ((background_noise_present IS DISTINCT FROM false) OR background_noise_severity = 'none')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_items TO authenticated;
GRANT ALL ON public.analysis_items TO service_role;
ALTER TABLE public.analysis_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view batch items" ON public.analysis_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.analysis_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()));
CREATE POLICY "Owners create batch items" ON public.analysis_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.analysis_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()));
CREATE POLICY "Owners update batch items" ON public.analysis_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.analysis_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.analysis_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()));
CREATE POLICY "Owners delete batch items" ON public.analysis_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.analysis_batches b WHERE b.id = batch_id AND b.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER analysis_batches_updated_at BEFORE UPDATE ON public.analysis_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER analysis_items_updated_at BEFORE UPDATE ON public.analysis_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX analysis_batches_owner_created_idx ON public.analysis_batches(owner_id, created_at DESC);
CREATE INDEX analysis_items_batch_status_idx ON public.analysis_items(batch_id, status);
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_items;

CREATE POLICY "Users upload own audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audio-batches' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own audio" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'audio-batches' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own audio" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'audio-batches' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'audio-batches' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own audio" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'audio-batches' AND (storage.foldername(name))[1] = auth.uid()::text);