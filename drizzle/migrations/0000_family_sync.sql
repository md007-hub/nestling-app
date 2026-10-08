CREATE TABLE public.babies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.baby_members (
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'parent',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (baby_id, user_id)
);
CREATE TABLE public.baby_logs (
  id uuid PRIMARY KEY,
  baby_id uuid NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  type text NOT NULL,
  value text NOT NULL,
  notes text,
  ts bigint NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX baby_logs_baby_ts ON public.baby_logs(baby_id, ts DESC);

GRANT SELECT, UPDATE ON public.babies TO authenticated;
GRANT SELECT, DELETE ON public.baby_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.baby_logs TO authenticated;
GRANT ALL ON public.babies, public.baby_members, public.baby_logs TO service_role;

ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_baby_member(_baby uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.baby_members WHERE baby_id = _baby AND user_id = auth.uid())
$$;

CREATE POLICY "members read babies" ON public.babies FOR SELECT TO authenticated USING (public.is_baby_member(id));
CREATE POLICY "members update babies" ON public.babies FOR UPDATE TO authenticated USING (public.is_baby_member(id)) WITH CHECK (public.is_baby_member(id));
CREATE POLICY "members read members" ON public.baby_members FOR SELECT TO authenticated USING (public.is_baby_member(baby_id));
CREATE POLICY "leave baby" ON public.baby_members FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members read logs" ON public.baby_logs FOR SELECT TO authenticated USING (public.is_baby_member(baby_id));
CREATE POLICY "members add logs" ON public.baby_logs FOR INSERT TO authenticated WITH CHECK (public.is_baby_member(baby_id));
CREATE POLICY "members edit logs" ON public.baby_logs FOR UPDATE TO authenticated USING (public.is_baby_member(baby_id)) WITH CHECK (public.is_baby_member(baby_id));
CREATE POLICY "members delete logs" ON public.baby_logs FOR DELETE TO authenticated USING (public.is_baby_member(baby_id));

CREATE OR REPLACE FUNCTION public.create_baby(_name text)
RETURNS public.babies LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.babies; code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF coalesce(trim(_name), '') = '' OR length(_name) > 60 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  LOOP
    code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1Il', ''), 1, 6));
    EXIT WHEN length(code) = 6 AND NOT EXISTS (SELECT 1 FROM public.babies WHERE invite_code = code);
  END LOOP;
  INSERT INTO public.babies(name, invite_code, created_by) VALUES (trim(_name), code, auth.uid()) RETURNING * INTO b;
  INSERT INTO public.baby_members(baby_id, user_id, role) VALUES (b.id, auth.uid(), 'owner');
  RETURN b;
END $$;

CREATE OR REPLACE FUNCTION public.join_baby(_code text)
RETURNS public.babies LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.babies;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO b FROM public.babies WHERE invite_code = upper(trim(_code));
  IF b.id IS NULL THEN RAISE EXCEPTION 'Invite code not found'; END IF;
  INSERT INTO public.baby_members(baby_id, user_id) VALUES (b.id, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN b;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_baby(text), public.join_baby(text), public.is_baby_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_baby(text), public.join_baby(text), public.is_baby_member(uuid) TO authenticated;

ALTER TABLE public.baby_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.baby_logs;