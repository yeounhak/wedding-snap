// DB access for admin-editable prompt overrides (the `prompt_templates` table).
//
// Kept separate from app/_lib/prompts.ts (the pure resolver) so prompts.ts has no
// Supabase dependency. The Temporal worker imports BOTH — this loader plus the
// resolver — so DO NOT add `import "server-only"` here (the worker is a plain
// Node process, not a Next.js server, and `server-only` throws there).
//
// AUTHORIZATION: prompt_templates has RLS enabled with NO policies, so the only
// access path is the service-role client below (it bypasses RLS) — matching every
// other table in this schema. There is no DB-level row gating: the ONLY HTTP
// authorization is the admin allowlist in app/_lib/admin-auth.ts, enforced by
// app/api/admin/prompts/route.ts. Never expose these writers on an unguarded route.
//
// One row per subject_mode (the single editable template for that mode).

import { createSupabaseAdminClient } from "./supabase/admin";
import {
  type PromptTemplateStore,
  type SubjectMode,
  SUBJECT_MODES,
} from "./prompts";

const TABLE = "prompt_templates";

export type PromptTemplateRow = {
  subjectMode: SubjectMode;
  template: string;
  updatedAt: string;
  updatedBy: string | null;
};

export function buildPromptTemplateStore(rows: PromptTemplateRow[]): PromptTemplateStore {
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.subjectMode, r.template);
  return { get: (mode) => map.get(mode) };
}

export function emptyPromptTemplateStore(): PromptTemplateStore {
  return { get: () => undefined };
}

function isSubjectMode(v: unknown): v is SubjectMode {
  return typeof v === "string" && (SUBJECT_MODES as readonly string[]).includes(v);
}

function rowFromRecord(d: Record<string, unknown>): PromptTemplateRow | null {
  if (!isSubjectMode(d.subject_mode)) return null;
  if (typeof d.template !== "string") return null;
  return {
    subjectMode: d.subject_mode,
    template: d.template,
    updatedAt: typeof d.updated_at === "string" ? d.updated_at : "",
    updatedBy: typeof d.updated_by === "string" ? d.updated_by : null,
  };
}

// Loads all editable prompt overrides into an in-memory store. NEVER throws — a
// DB hiccup (or a missing table before the migration is applied) must not fail a
// paid generation; callers transparently degrade to env + computed defaults.
export async function loadPromptTemplates(): Promise<PromptTemplateStore> {
  const rows = await listPromptTemplateRows();
  return buildPromptTemplateStore(rows);
}

export async function listPromptTemplateRows(): Promise<PromptTemplateRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("subject_mode, template, updated_at, updated_by");
    if (error || !data) return [];
    return (data as Record<string, unknown>[])
      .map(rowFromRecord)
      .filter((r): r is PromptTemplateRow => r !== null);
  } catch {
    return [];
  }
}

export type UpsertPromptTemplateInput = {
  subjectMode: SubjectMode;
  template: string;
  updatedBy: string | null;
};

export async function upsertPromptTemplate(input: UpsertPromptTemplateInput): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      subject_mode: input.subjectMode,
      template: input.template,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "subject_mode" },
  );
  if (error) throw new Error(error.message);
}

export async function deletePromptTemplate(subjectMode: SubjectMode): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).delete().match({ subject_mode: subjectMode });
  if (error) throw new Error(error.message);
}
