"use client";

import { useState } from "react";

import type {
  ModePromptMatrix,
  OpenAIConfigInfo,
  PromptMatrixData,
  PromptTemplateCell,
  SubjectMode,
  TemplateSource,
} from "@/app/_lib/prompts";

// Display order matches how the product talks about uploads: 신랑 / 신랑+신부 / 신부.
const MODE_ORDER: SubjectMode[] = ["groom", "couple", "bride"];

const MODE_LABEL: Record<SubjectMode, { title: string; subtitle: string }> = {
  groom: { title: "신랑", subtitle: "신랑 사진만 업로드" },
  couple: { title: "신랑 + 신부", subtitle: "두 사진 모두 업로드" },
  bride: { title: "신부", subtitle: "신부 사진만 업로드" },
};

type Tone = "neutral" | "env" | "db";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  env: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  db: "bg-violet-50 text-violet-700 ring-violet-200",
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

function Env({ name }: { name: string }) {
  return (
    <code className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] text-neutral-100">
      {name}
    </code>
  );
}

function provenance(source: TemplateSource): { tone: Tone; label: string } {
  switch (source) {
    case "env-mode":
      return { tone: "env", label: "환경변수 재정의" };
    case "db":
      return { tone: "db", label: "편집됨" };
    case "computed":
      return { tone: "neutral", label: "기본값 (코드)" };
  }
}

function PromptField({ label, text, mono }: { label: string; text: string; mono?: boolean }) {
  return (
    <div className="mt-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <pre
        className={`max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700 ring-1 ring-inset ring-neutral-100 ${mono ? "font-mono text-[12px]" : "font-sans"}`}
      >
        {text}
      </pre>
    </div>
  );
}

function ModeTemplateEditor({
  cell,
  onUpdated,
}: {
  cell: PromptTemplateCell;
  onUpdated: (cell: PromptTemplateCell) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cell.editorSeed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prov = provenance(cell.source);
  const envShadowed = cell.source === "env-mode";
  const dbOverride = cell.source === "db";

  function startEditing() {
    setDraft(cell.editorSeed);
    setError(null);
    setEditing(true);
  }

  async function mutate(method: "PUT" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prompts", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectMode: cell.subjectMode,
          ...(method === "PUT" ? { template: draft } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; cell?: PromptTemplateCell; error?: string };
      if (!res.ok || !data.cell) throw new Error(data.error ?? "요청 실패");
      onUpdated(data.cell);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={prov.tone}>{prov.label}</Badge>
        {cell.envVar ? <Env name={cell.envVar} /> : null}
      </div>

      {!editing ? (
        <>
          <PromptField label="실제 전송 · 영어" text={cell.resolved} mono />
          {cell.resolvedKo ? (
            <PromptField label="한국어 번역 (참고용)" text={cell.resolvedKo} />
          ) : (
            <p className="mt-2 text-[11px] text-neutral-400">
              한국어 번역 없음 — 직접 입력한 영어 프롬프트입니다.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
            >
              편집 (영어)
            </button>
            {dbOverride ? (
              <button
                type="button"
                onClick={() => mutate("DELETE")}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-50 disabled:opacity-40"
              >
                기본값으로 초기화
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-neutral-400">
            영어로 입력하세요. <code className="font-mono">{"{title}"}</code> /{" "}
            <code className="font-mono">{"{category}"}</code> 는 생성 시 장소 값으로 치환됩니다.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-neutral-200 bg-white p-3 font-mono text-[12px] leading-relaxed text-neutral-800 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          />
          {envShadowed ? (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 ring-1 ring-inset ring-amber-200">
              이 모드는 환경변수 override가 우선합니다. 저장은 되지만 env가 설정된 동안에는 실제
              생성에 반영되지 않습니다.
            </p>
          ) : null}
          {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => mutate("PUT")}
              disabled={busy || !draft.trim()}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-40"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-40"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PromptMatrix({
  matrix,
  openai,
  adminEmail,
}: {
  matrix: PromptMatrixData;
  openai: OpenAIConfigInfo;
  adminEmail: string;
}) {
  const [modes, setModes] = useState<ModePromptMatrix[]>(matrix.modes);
  const [activeMode, setActiveMode] = useState<SubjectMode>("couple");

  function handleUpdated(updated: PromptTemplateCell) {
    setModes((prev) =>
      prev.map((m) => (m.subjectMode === updated.subjectMode ? { ...m, template: updated } : m)),
    );
  }

  const active = modes.find((m) => m.subjectMode === activeMode) ?? modes[0];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">프롬프트 템플릿</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-neutral-500">
            모든 생성은 실제 장소 사진을 배경으로 합성합니다. 업로드 형태(신랑 / 신랑+신부 / 신부)별로
            프롬프트 1개를 관리하며, 한 번에 이미지 {openai.imagesPerJob}장을 같은 프롬프트로 생성합니다
            (호출이 독립적이라 4장이 서로 다르게 나옵니다).
          </p>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-xs text-neutral-400">
          <Badge tone="db">편집 가능</Badge>
          {adminEmail ? <span>{adminEmail}</span> : null}
        </div>
      </div>

      {/* Real request structure */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">실제 전송 구조</h2>
          <code className="rounded bg-neutral-900 px-2 py-0.5 font-mono text-[11px] text-neutral-100">
            openai.{openai.endpoint}
          </code>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
          이미지 생성은 채팅이 아니라 <code className="font-mono">images.edit</code> 호출이라
          system/user 역할 구분이 없습니다. <span className="font-medium">입력 이미지 배열 + 단일 프롬프트
          문자열 + 파라미터</span>가 전부입니다.
        </p>
        <pre className="mt-3 overflow-auto rounded-lg bg-neutral-900 p-3 font-mono text-[11.5px] leading-relaxed text-neutral-100">
{`openai.${openai.endpoint}({
  model: "${openai.model.value}",
  image: [ ${active.imageInputs.join(", ")} ],   // ← ${MODE_LABEL[active.subjectMode].title} 모드 입력 순서
  prompt: <아래 프롬프트 템플릿>,                   // ← 단일 문자열
  size: "${openai.size.value}",  quality: "${openai.quality.value}",
  background: "${openai.background}",  output_format: "${openai.outputFormat}",  n: 1,
})  ×${openai.imagesPerJob} (병렬 호출 — 4장 생성)`}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-400">
          <ConfigChip label="model" value={openai.model.value} envOrDefault={openai.model.isDefault ? "기본값" : openai.model.envVar} />
          <ConfigChip label="size" value={openai.size.value} envOrDefault={openai.size.isDefault ? "기본값" : openai.size.envVar} />
          <ConfigChip label="quality" value={openai.quality.value} envOrDefault={openai.quality.isDefault ? "기본값" : openai.quality.envVar} />
          <span className="rounded-md bg-neutral-50 px-2 py-1 ring-1 ring-inset ring-neutral-100">
            endpoint: {openai.baseUrlConfigured ? "커스텀 (OPENAI_BASE_URL)" : "기본 api.openai.com"}
          </span>
        </div>
      </section>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        {MODE_ORDER.map((mode) => {
          const isActive = mode === active.subjectMode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setActiveMode(mode)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {MODE_LABEL[mode].title}
            </button>
          );
        })}
      </div>

      {/* Active mode template */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-neutral-900">
            {MODE_LABEL[active.subjectMode].title}
          </h2>
          <span className="text-xs text-neutral-400">{MODE_LABEL[active.subjectMode].subtitle}</span>
          <span className="ml-auto text-[11px] text-neutral-400">
            입력 순서: {active.imageInputs.join(" → ")}
          </span>
        </div>

        <ModeTemplateEditor
          key={active.subjectMode}
          cell={active.template}
          onUpdated={handleUpdated}
        />
      </section>

      <p className="pb-4 text-[11px] text-neutral-400">
        한국어 번역과 미리보기는 샘플 장소(<span className="font-medium">{matrix.sampleVenue.title}</span>
        {" · "}
        {matrix.sampleVenue.category})로 <code className="font-mono">{"{title}"}</code>/
        <code className="font-mono">{"{category}"}</code>를 치환해 보여줍니다. 실제 생성 시에는 job에
        배정된 장소 값이 들어갑니다. 한국어는 참고용이며 실제 전송은 영어입니다.
      </p>
    </div>
  );
}

function ConfigChip({ label, value, envOrDefault }: { label: string; value: string; envOrDefault: string }) {
  return (
    <span className="rounded-md bg-neutral-50 px-2 py-1 ring-1 ring-inset ring-neutral-100">
      <span className="font-medium text-neutral-500">{label}</span>: {value}{" "}
      <span className="text-neutral-300">· {envOrDefault}</span>
    </span>
  );
}
