CREATE POLICY "Members read baby photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'baby-photos' AND public.is_baby_member(((storage.foldername(name))[1])::uuid));