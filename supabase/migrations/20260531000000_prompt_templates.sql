-- Admin-editable generation prompt overrides.
--
-- Source-of-truth precedence at resolution time (app/_lib/prompts.ts):
--   env per-slot/per-mode/legacy overrides  >  THIS TABLE (per-slot)  >  code defaults
-- env stays above the DB as an operational emergency hatch; this table is the
-- normal layer the /admin console edits.
--
-- `slot` is 1..4 (one row per generated image; GENERATED_IMAGES_PER_JOB = 4).
-- `kind` distinguishes the base (no-venue) prompt from the venue (real-location
-- background) prompt. Venue templates may contain {title}/{category} which are
-- interpolated at generation time.

create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  subject_mode text not null check (subject_mode in ('couple', 'bride', 'groom')),
  kind text not null check (kind in ('base', 'venue')),
  slot smallint not null check (slot between 1 and 4),
  template text not null check (length(btrim(template)) > 0),
  updated_at timestamptz not null default now(),
  updated_by text
);

create unique index if not exists prompt_templates_mode_kind_slot
  on public.prompt_templates (subject_mode, kind, slot);

-- RLS on, no policies: only the service-role client (used by the Temporal worker
-- and the admin API) bypasses RLS. This mirrors every other table in the schema
-- (RLS-enabled, access only via service_role / security-definer functions).
alter table public.prompt_templates enable row level security;

create or replace function public.prompt_templates_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prompt_templates_touch on public.prompt_templates;
create trigger prompt_templates_touch
  before update on public.prompt_templates
  for each row
  execute function public.prompt_templates_touch_updated_at();
