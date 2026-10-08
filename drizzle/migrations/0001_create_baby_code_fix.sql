CREATE OR REPLACE FUNCTION public.create_baby(_name text)
RETURNS public.babies LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.babies; code text; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF coalesce(trim(_name), '') = '' OR length(_name) > 60 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  LOOP
    code := '';
    FOR i IN 1..6 LOOP code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.babies WHERE invite_code = code);
  END LOOP;
  INSERT INTO public.babies(name, invite_code, created_by) VALUES (trim(_name), code, auth.uid()) RETURNING * INTO b;
  INSERT INTO public.baby_members(baby_id, user_id, role) VALUES (b.id, auth.uid(), 'owner');
  RETURN b;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_baby(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_baby(text) TO authenticated;