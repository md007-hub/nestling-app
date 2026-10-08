ALTER TABLE public.babies ADD COLUMN birth_date date, ADD COLUMN date_kind text NOT NULL DEFAULT 'birth', ADD COLUMN gender text, ADD COLUMN birth_weight_kg numeric(5,2);
ALTER TABLE public.babies ADD CONSTRAINT babies_date_kind_check CHECK (date_kind IN ('birth', 'due'));
ALTER TABLE public.babies ADD CONSTRAINT babies_gender_check CHECK (gender IS NULL OR gender IN ('girl', 'boy', 'other', 'prefer_not_to_say'));
ALTER TABLE public.babies ADD CONSTRAINT babies_birth_weight_check CHECK (birth_weight_kg IS NULL OR birth_weight_kg > 0);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, display_name text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE OR REPLACE FUNCTION public.consume_ai_question(check_env text, _day date) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare used int; pro boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  pro := public.has_family_pro(check_env);
  if pro then return json_build_object('allowed', true, 'pro', true, 'used', 0); end if;
  select count into used from public.ai_usage where user_id = auth.uid() and day = _day;
  used := coalesce(used, 0);
  if used >= 5 then return json_build_object('allowed', false, 'pro', false, 'used', used); end if;
  insert into public.ai_usage(user_id, day, count) values (auth.uid(), _day, 1)
    on conflict (user_id, day) do update set count = public.ai_usage.count + 1;
  return json_build_object('allowed', true, 'pro', false, 'used', used + 1);
end $function$;