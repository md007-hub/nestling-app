ALTER TABLE public.babies ADD COLUMN IF NOT EXISTS photo_url text;
CREATE POLICY "Members upload baby photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'baby-photos' AND public.is_baby_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Members update baby photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'baby-photos' AND public.is_baby_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Members delete baby photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'baby-photos' AND public.is_baby_member(((storage.foldername(name))[1])::uuid));