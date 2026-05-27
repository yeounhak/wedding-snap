alter table public.generation_jobs
  add column if not exists temporal_worker_deployment_name text,
  add column if not exists temporal_worker_build_id text;

create index if not exists generation_jobs_temporal_worker_version_idx
  on public.generation_jobs (
    temporal_worker_deployment_name,
    temporal_worker_build_id
  )
  where temporal_worker_build_id is not null;
