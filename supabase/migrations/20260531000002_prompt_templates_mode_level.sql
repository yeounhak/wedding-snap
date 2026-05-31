-- Collapse prompt_templates to ONE row per subject_mode.
--
-- Per-slot prompts were dropped: every generated image of a job uses the same
-- mode prompt (variety comes from independent images.edit calls, not per-image
-- prompts). Safe: the table is still empty (created 20260531000000, simplified
-- 20260531000001), so no data is lost.

drop index if exists prompt_templates_mode_slot;

alter table public.prompt_templates drop column if exists slot;

create unique index if not exists prompt_templates_mode
  on public.prompt_templates (subject_mode);
