-- Opt-in public sharing of a generated result.
-- Set when the owner shares a job; the public /s/[id] page and the watermarked
-- image endpoint check this flag before serving to non-owners.
alter table public.generation_jobs
  add column if not exists shared_at timestamptz;

create index if not exists generation_jobs_shared_at_idx
  on public.generation_jobs(shared_at)
  where shared_at is not null;
