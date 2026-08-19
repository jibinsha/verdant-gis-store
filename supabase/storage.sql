-- VERDANT GIS STORAGE
-- Create these two buckets in Supabase Dashboard:
-- 1) dataset-previews  -> PUBLIC (only small preview GeoJSON files)
-- 2) dataset-files     -> PRIVATE (paid source ZIP/GPKG/etc.)

-- Storage policies for the public preview bucket.
-- These policies assume public read access for previews.
drop policy if exists "Public read dataset previews" on storage.objects;
create policy "Public read dataset previews"
on storage.objects for select
using (bucket_id = 'dataset-previews');

drop policy if exists "Admins upload dataset previews" on storage.objects;
create policy "Admins upload dataset previews"
on storage.objects for insert
with check (
  bucket_id = 'dataset-previews'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins update dataset previews" on storage.objects;
create policy "Admins update dataset previews"
on storage.objects for update
using (
  bucket_id = 'dataset-previews'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins delete dataset previews" on storage.objects;
create policy "Admins delete dataset previews"
on storage.objects for delete
using (
  bucket_id = 'dataset-previews'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Paid source files remain private.
drop policy if exists "Admins upload dataset files" on storage.objects;
create policy "Admins upload dataset files"
on storage.objects for insert
with check (
  bucket_id = 'dataset-files'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins manage dataset files" on storage.objects;
create policy "Admins manage dataset files"
on storage.objects for update
using (
  bucket_id = 'dataset-files'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins delete dataset files" on storage.objects;
create policy "Admins delete dataset files"
on storage.objects for delete
using (
  bucket_id = 'dataset-files'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
