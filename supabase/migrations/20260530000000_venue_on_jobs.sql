-- Phase 0 gate passed (2026-05-30): feeding a real 4-star venue image into images.edit
-- preserves identity and composites the subject INTO the venue. Persist the venue used
-- for each job so (a) the Temporal activity can build the V2 venue-aware prompt and
-- (b) the gallery/result/share screens can surface a clickable rental link.
--
-- All columns nullable + additive: existing and no-venue jobs are unaffected. venue_id
-- is a loose reference to wedding-snap-admin's admin_places.id (an INTEGER identity column,
-- same DB, but NO FK — the admin crawler soft-deletes rows, so we denormalize
-- title/rental_url onto the job to survive venue removal).
alter table public.generation_jobs
  add column if not exists venue_id bigint,
  add column if not exists venue_object_path text,
  add column if not exists venue_title text,
  add column if not exists venue_category text,
  add column if not exists venue_rental_url text;

comment on column public.generation_jobs.venue_id is 'admin_places.id (bigint) used as the real-location backdrop (loose ref, no FK)';
comment on column public.generation_jobs.venue_object_path is 'storage path of the mirrored venue image fed into images.edit';
