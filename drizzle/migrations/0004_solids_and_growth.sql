ALTER TABLE public.babies ADD COLUMN IF NOT EXISTS solids_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.baby_growth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  measured_on date NOT NULL,
  weight_kg numeric CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 40)),
  length_cm numeric CHECK (length_cm IS NULL OR (length_cm > 20 AND length_cm < 130)),
  head_cm numeric CHECK (head_cm IS NULL OR (head_cm > 20 AND head_cm < 70)),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (weight_kg IS NOT NULL OR length_cm IS NOT NULL OR head_cm IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baby_growth TO authenticated;
GRANT ALL ON public.baby_growth TO service_role;
ALTER TABLE public.baby_growth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read growth" ON public.baby_growth FOR SELECT TO authenticated USING (public.is_baby_member(baby_id));
CREATE POLICY "members add growth" ON public.baby_growth FOR INSERT TO authenticated WITH CHECK (public.is_baby_member(baby_id));
CREATE POLICY "members edit growth" ON public.baby_growth FOR UPDATE TO authenticated USING (public.is_baby_member(baby_id)) WITH CHECK (public.is_baby_member(baby_id));
CREATE POLICY "members delete growth" ON public.baby_growth FOR DELETE TO authenticated USING (public.is_baby_member(baby_id));
CREATE INDEX baby_growth_baby_idx ON public.baby_growth (baby_id, measured_on);