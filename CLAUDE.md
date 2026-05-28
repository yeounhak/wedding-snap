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

Prompt branching lives in `temporal/activities.ts` (`resolvePrompt(subjectMode, index)`):
- Per-slot overrides are checked first as `WEDDING_SNAP_PROMPT_{COUPLE|BRIDE|GROOM}_1` through `_4`; this keeps the four generated images independent instead of using `n=4`.
- `couple` → `COUPLE_PROMPT`, overridable by `WEDDING_SNAP_PROMPT_COUPLE` or legacy `WEDDING_SNAP_PROMPT`
- `bride` → `BRIDE_PROMPT`, overridable by `WEDDING_SNAP_PROMPT_BRIDE`
- `groom` → `GROOM_PROMPT`, overridable by `WEDDING_SNAP_PROMPT_GROOM`

The OpenAI `images.edit` call passes a variable-length array of `createReadStream`s, one per available input image. Each job generates four outputs by running four independent `images.edit({ n: 1 })` calls in parallel; the first result keeps the legacy `clean.jpg` / `watermarked.jpg` paths and the rest use indexed paths.

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
