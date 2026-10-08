ALTER TABLE public.babies ADD COLUMN milestones_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE public.baby_milestones (
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (note IS NULL OR length(note) <= 200),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  PRIMARY KEY (baby_id, milestone_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baby_milestones TO authenticated;
GRANT ALL ON public.baby_milestones TO service_role;
ALTER TABLE public.baby_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read milestones" ON public.baby_milestones FOR SELECT TO authenticated USING (public.is_baby_member(baby_id));
CREATE POLICY "members add milestones" ON public.baby_milestones FOR INSERT TO authenticated WITH CHECK (public.is_baby_member(baby_id));
CREATE POLICY "members edit milestones" ON public.baby_milestones FOR UPDATE TO authenticated USING (public.is_baby_member(baby_id)) WITH CHECK (public.is_baby_member(baby_id));
CREATE POLICY "members delete milestones" ON public.baby_milestones FOR DELETE TO authenticated USING (public.is_baby_member(baby_id));