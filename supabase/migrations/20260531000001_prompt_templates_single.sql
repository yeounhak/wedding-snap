-- Collapse prompt_templates to a SINGLE template per (subject_mode, slot).
--
-- The no-venue "base" prompt was removed: every generation now composites a real
-- venue image, so the base vs venue distinction (the `kind` column) is gone.
-- Safe: the table was created empty in 20260531000000 and has no rows yet.

drop index if exists prompt_templates_mode_kind_slot;

alter table public.prompt_templates drop column if exists kind;

create unique index if not exists prompt_templates_mode_slot
  on public.prompt_templates (subject_mode, slot);
