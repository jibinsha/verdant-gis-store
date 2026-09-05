-- Map Explorer preview is required for every published dataset.
-- This prevents direct database/API updates from publishing a dataset
-- without a GeoJSON preview.
--
-- Run this migration in Supabase SQL Editor after existing datasets have
-- been checked for missing preview_geojson_url values.

alter table public.datasets
  drop constraint if exists datasets_published_requires_geojson;

alter table public.datasets
  add constraint datasets_published_requires_geojson
  check (
    status <> 'published'
    or nullif(trim(preview_geojson_url), '') is not null
  );
