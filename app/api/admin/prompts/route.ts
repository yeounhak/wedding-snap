import { NextResponse } from "next/server";

import { getAdminUser } from "@/app/_lib/admin-auth";
import {
  DEFAULT_SAMPLE_VENUE,
  describeTemplate,
  type SubjectMode,
  SUBJECT_MODES,
} from "@/app/_lib/prompts";
import {
  deletePromptTemplate,
  loadPromptTemplates,
  upsertPromptTemplate,
} from "@/app/_lib/prompt-templates";

export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function parseMode(body: unknown): SubjectMode | null {
  const rec = asRecord(body);
  const mode = rec?.subjectMode;
  if (typeof mode !== "string" || !(SUBJECT_MODES as readonly string[]).includes(mode)) {
    return null;
  }
  return mode as SubjectMode;
}

// Re-resolve the cell from a freshly loaded store so the client sees the TRUE
// effective value + provenance (e.g. an env override may still shadow the DB).
async function describeCell(mode: SubjectMode) {
  const store = await loadPromptTemplates();
  return describeTemplate(mode, DEFAULT_SAMPLE_VENUE, store);
}

export async function PUT(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const mode = parseMode(body);
  if (!mode) return NextResponse.json({ error: "invalid subjectMode" }, { status: 400 });

  const rec = asRecord(body);
  const template = typeof rec?.template === "string" ? rec.template : "";
  if (!template.trim()) {
    return NextResponse.json({ error: "template is required" }, { status: 400 });
  }

  try {
    await upsertPromptTemplate({ subjectMode: mode, template, updatedBy: admin.email ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "save failed" },
      { status: 500 },
    );
  }

  const cell = await describeCell(mode);
  return NextResponse.json({ ok: true, cell });
}

export async function DELETE(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const mode = parseMode(body);
  if (!mode) return NextResponse.json({ error: "invalid subjectMode" }, { status: 400 });

  try {
    await deletePromptTemplate(mode);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "reset failed" },
      { status: 500 },
    );
  }

  const cell = await describeCell(mode);
  return NextResponse.json({ ok: true, cell });
}
