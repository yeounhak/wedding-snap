# Project conventions for Wedding Snap

This file is the canonical agent guide. `AGENTS.md` exists only as a pointer here so Codex and other agents follow the same source.

## This is NOT the Next.js you know

This repo runs Next.js 16. APIs, conventions, and file structure differ from the App Router most LLMs know. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code, and heed deprecation notices.

Particularly:
- The platform-level request interceptor lives in **`proxy.ts`**, not `middleware.ts`. It refreshes the Supabase session on every page navigation so server components can read a fresh user.
- Server components **cannot write cookies** in Next.js 16 SSR. Anything that needs to set a cookie must run in a route handler (`app/api/.../route.ts`) or the proxy. The Supabase setAll callback in `app/_lib/supabase/server.ts` is intentionally a try/catch noop for this reason.

## Root routing pattern

`/` is **not a page** — it's a server-component redirector at `app/page.tsx`.

- If the `wedding_snap_has_logged_in` cookie is present → `redirect("/gallery")`
- Otherwise → `redirect("/welcome")`

The cookie is a 1-year httpOnly marker set in the Supabase OAuth callback (`app/api/auth/callback/route.ts`) on successful login. Constants live in `app/_lib/kakao-auth.ts` (`WEDDING_SNAP_HAS_LOGGED_IN_COOKIE`, `WEDDING_SNAP_HAS_LOGGED_IN_MAX_AGE`). It survives sign-out — only the account-delete endpoint clears it.

Concrete consequences when changing user-facing links:
- The marketing landing + upload + generate single-page app lives at **`/welcome`** (renders `<AppShell />`). Anything that historically pointed to `/` to reach the AppShell (e.g. the unlock-after-login next URL, "back home" buttons inside `/gallery`) must point to `/welcome` instead — `/` will redirect logged-in users back to `/gallery` and lose query params.
- Post-Kakao redirects that want to land on the AppShell must use `next=/welcome?...`, not `next=/?...`.

## Kakao login

`/api/auth/kakao/login` starts Supabase's Kakao OAuth flow and requests
`profile_nickname profile_image account_email`. The Kakao app must use the
Supabase Auth callback URL, and Supabase should not allow provider users without
an email because Kakao `account_email` is required.

## Single-photo (solo) generation

A job can run with **just the bride photo, just the groom photo, or both.** There is no explicit `subject_mode` column — it is derived from which `input_*_object_path` is populated.

```ts
// app/_lib/generate-jobs.ts
function deriveSubjectMode(male, female) {
  if (male && female) return "couple";
  if (female) return "bride";
  return "groom";
}
```

DB enforcement (migration `20260528000000_solo_generation.sql`):
- `input_male_*` and `input_female_*` are all nullable
- `generation_jobs_inputs_present` CHECK: at least one role present
- `generation_jobs_{male,female}_pair` CHECK: object_path and mime_type are populated together or both null

Prompt resolution lives in **`app/_lib/prompts.ts`** (`resolveTemplate` / `describeTemplate`), the SINGLE source of truth shared by the worker (`temporal/activities.ts` imports it) and the `/admin/prompts` console. There is **ONE venue-aware template per `subjectMode`** (no per-slot prompts) — the old no-venue "base" prompt was removed; every generation composites a real venue image (fed as the LAST input) and a job **without a venue fails** (`ApplicationFailure "VenueRequired"`). Precedence per `subjectMode`, highest first:
- **env per-mode** `WEDDING_SNAP_PROMPT_{COUPLE|BRIDE|GROOM}` (operational emergency hatch)
- **DB** `prompt_templates` row, one per `subject_mode` (admin-editable; loaded once per job via `loadPromptTemplates()` in `app/_lib/prompt-templates.ts`; degrades to empty store on any error so a DB hiccup never fails a paid job)
- **code default** computed `templateDefault()` (Phase 0 V2 background-only wording; `{title}`/`{category}` interpolated). `templateDefaultKo()` is its Korean translation — DISPLAY ONLY; the English is what is sent.

env stays ABOVE the DB as an operational emergency hatch. The worker resolves in its own process, so DB edits affect generation only after the worker ships this code (then live, no redeploy). Admin gating: `ADMIN_EMAILS` allowlist (Kakao login emails) via `app/_lib/admin-auth.ts`; the console is desktop-first at `app/admin/` with its own viewport override and shows the real `images.edit` payload.

The OpenAI `images.edit` call passes a variable-length array of input images (people first, venue last) plus a single `prompt` string — there is no system/user split. Each job generates `GENERATED_IMAGES_PER_JOB` (4) outputs by running that ONE prompt through that many independent `images.edit({ n: 1 })` calls in parallel — variety comes from per-call randomness, not per-image prompts; the first result keeps the legacy `clean.jpg` / `watermarked.jpg` paths and the rest use indexed paths.

> **Deploy ordering:** the `/welcome` AppShell generate flow (`GenerateSection`) currently sends NO venue, so once the worker ships the venue-required code those jobs would fail. `/generate` (auto venue) is the intended generation entry point — migrate/disable the AppShell generate path (or attach `venueAuto`) before deploying the worker.

## UI flow for upload + generate

`AppShell` (rendered at `/welcome`) is a three-snap vertical scroller (landing → upload → generate). Auto-advance behavior:
- Both photos uploaded → 550ms delay then auto-scroll to generate (legacy behavior)
- Only one uploaded → no auto-advance; a "신부 사진만 생성하기" / "신랑 사진만 생성하기" button appears in `UploadSection` and the user explicitly opts in

`GenerateSection` derives `subjectMode` from the files it received and:
- Branches the success-state title ("두 분의 웨딩 사진이에요" / "신부 웨딩 사진이에요" / "신랑 웨딩 사진이에요")
- Sends only present files to `/api/generate` (FormData fields are optional)
- Displays the returned `resultUrls` as a swipeable four-image bundle. Gallery cards are one card per `generation_jobs` row, and the detail viewer swipes through that row's images.

## Database access

- Migrations live in `supabase/migrations/` and the remote is the Seoul-region Supabase project `wedding-snap` (`bgvasypuyqqcoqijbavc`). The `supabase_migrations.schema_migrations` history table was bootstrapped manually — early migrations were applied outside the CLI, so `supabase db push --include-all` will trip over already-applied DDL. Apply new migrations with `psql "$SUPABASE_DATABASE_URL" -f <file>` and then insert a row into `supabase_migrations.schema_migrations`.
- `SUPABASE_DATABASE_URL` in `.env` is single-quoted; strip the quotes before piping it to `psql`/`supabase` (see commit history for the pattern).
