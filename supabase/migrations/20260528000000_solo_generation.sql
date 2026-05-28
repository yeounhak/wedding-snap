-- Allow generation jobs to run with only one reference photo (bride-only or
-- groom-only). The original schema required both, but we now support solo
-- portrait jobs that branch the OpenAI prompt by the populated role.

alter table public.generation_jobs
  alter column input_male_object_path drop not null,
  alter column input_male_mime_type drop not null,
  alter column input_female_object_path drop not null,
  alter column input_female_mime_type drop not null;

alter table public.generation_jobs
  add constraint generation_jobs_inputs_present check (
    input_male_object_path is not null
    or input_female_object_path is not null
  );

alter table public.generation_jobs
  add constraint generation_jobs_male_pair check (
    (input_male_object_path is null and input_male_mime_type is null)
    or (input_male_object_path is not null and input_male_mime_type is not null)
  );

alter table public.generation_jobs
  add constraint generation_jobs_female_pair check (
    (input_female_object_path is null and input_female_mime_type is null)
    or (input_female_object_path is not null and input_female_mime_type is not null)
  );
