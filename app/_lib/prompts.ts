// Shared generation-prompt resolution.
//
// SINGLE source of truth, imported by both the Temporal worker
// (temporal/activities.ts) and the admin console (app/admin/prompts).
//
// MODEL: every generation composites the subject(s) INTO a real venue image (fed
// as the LAST input to images.edit). There is exactly ONE prompt template per
// subjectMode. A job produces GENERATED_IMAGES_PER_JOB images by running that one
// prompt through that many independent images.edit calls — variety comes from the
// model's per-call randomness, not from per-image prompts. A job without a venue
// fails in the worker rather than degrading.
//
// Resolution precedence per subjectMode, highest first:
//   WEDDING_SNAP_PROMPT_{MODE}          (env override — operational emergency hatch)
//   prompt_templates DB row             (admin-editable)
//   templateDefault()                   (computed code default; {title}/{category} aware)
//
// Templates may contain {title}/{category}, interpolated with the job's venue at
// generation time.

import { GENERATED_IMAGES_PER_JOB } from "./generate-jobs";

export type SubjectMode = "couple" | "bride" | "groom";

export const SUBJECT_MODES: readonly SubjectMode[] = ["couple", "bride", "groom"];

export type VenueInfo = { title: string | null; category: string | null };

// In-memory view of admin-editable prompt_templates rows: the override template
// for a subjectMode, or undefined.
export interface PromptTemplateStore {
  get(mode: SubjectMode): string | undefined;
}

// What images.edit receives, in order, per subject mode (the people first, the
// venue last). Mirrors how temporal/activities.ts builds the `image` array.
export const IMAGE_INPUTS: Record<SubjectMode, string[]> = {
  couple: ["신랑 사진", "신부 사진", "장소 사진"],
  bride: ["신부 사진", "장소 사진"],
  groom: ["신랑 사진", "장소 사진"],
};

export const VENUE_STYLE =
  "Use soft daylight, refined editorial photography, realistic skin texture. Do not add text, logos, watermarks, extra people, distorted hands, or surreal details.";

const VENUE_STYLE_KO =
  "부드러운 자연광, 정제된 에디토리얼 사진 톤, 사실적인 피부 질감을 사용합니다. 텍스트, 로고, 워터마크, 추가 인물, 왜곡된 손, 비현실적인 디테일은 넣지 않습니다.";

// Phase 0 winner (V2): venue image is the LAST input, treated as background ONLY —
// validated to preserve facial identity while compositing the subject into the
// real venue without pulling any person out of the venue photo.
export function templateDefault(subjectMode: SubjectMode, venue: VenueInfo) {
  const who =
    subjectMode === "bride" ? "the bride" : subjectMode === "groom" ? "the groom" : "the couple";
  const subjImgs =
    subjectMode === "couple" ? "the FIRST TWO reference images" : "the FIRST reference image";
  const loc = venue.title
    ? `The real location is "${venue.title}"${venue.category ? ` — ${venue.category}` : ""}.`
    : "";
  return [
    `Create a polished wedding photograph of ${who} using ${subjImgs} as the people.`,
    `Use the LAST reference image ONLY as the real-world background/location: place ${who} naturally INTO that scene as if actually photographed there, matching its lighting, perspective and depth of field.`,
    `CRITICAL: do NOT copy, add, borrow, or blend any person, face, or body from the background image — it is an empty location reference only.`,
    `Preserve ${subjectMode === "couple" ? "each person's" : "their"} facial identity and natural features. Dress ${who} in elegant wedding attire.`,
    loc,
    VENUE_STYLE,
  ]
    .filter(Boolean)
    .join(" ");
}

// Korean reference translation of templateDefault — DISPLAY ONLY (the English is
// what is sent to OpenAI). Keep in sync if you edit templateDefault.
export function templateDefaultKo(subjectMode: SubjectMode, venue: VenueInfo) {
  const who = subjectMode === "bride" ? "신부" : subjectMode === "groom" ? "신랑" : "두 사람";
  const whoObj =
    subjectMode === "bride" ? "신부를" : subjectMode === "groom" ? "신랑을" : "두 사람을";
  const whoDat =
    subjectMode === "bride" ? "신부에게" : subjectMode === "groom" ? "신랑에게" : "두 사람에게";
  const poss = subjectMode === "couple" ? "각 인물의" : "해당 인물의";
  const subjImgs = subjectMode === "couple" ? "처음 두 장의 참고 이미지" : "첫 번째 참고 이미지";
  const loc = venue.title
    ? `실제 장소는 "${venue.title}"${venue.category ? ` — ${venue.category}` : ""} 입니다.`
    : "";
  return [
    `${subjImgs}를 인물로 사용해 ${who}의 세련된 웨딩 사진을 만들어 주세요.`,
    `마지막 참고 이미지는 오직 실제 장소 배경으로만 사용하세요: ${whoObj} 그 장면 안에 실제로 그곳에서 촬영한 것처럼 자연스럽게 배치하고, 조명·원근감·피사계 심도를 장면에 맞춥니다.`,
    `중요: 배경 이미지에서 어떤 인물·얼굴·신체도 복사·추가·차용·합성하지 마세요. 배경은 인물이 없는 장소 참고용일 뿐입니다.`,
    `${poss} 얼굴 정체성과 자연스러운 이목구비를 유지합니다. ${whoDat} 우아한 웨딩 의상을 입힙니다.`,
    loc,
    VENUE_STYLE_KO,
  ]
    .filter(Boolean)
    .join(" ");
}

function interpolateVenue(template: string, venue: VenueInfo) {
  return template
    .replace(/\{title\}/g, venue.title ?? "")
    .replace(/\{category\}/g, venue.category ?? "");
}

// A {title}/{category}-templated form of the computed default — seeds the admin
// editor when no override exists yet, with the placeholders intact.
function templateSeed(subjectMode: SubjectMode) {
  return templateDefault(subjectMode, { title: "{title}", category: "{category}" });
}

export type TemplateSource = "env-mode" | "db" | "computed";

export type PromptTemplateCell = {
  subjectMode: SubjectMode;
  resolved: string; // after {title}/{category} interpolation (what gets sent)
  template: string | null; // raw override template before interpolation; null when computed
  resolvedKo: string | null; // Korean translation — only for the code default; null for custom/env
  source: TemplateSource;
  envVar: string | null;
  editorSeed: string; // raw template to pre-fill the editor with
};

function envOverride(
  subjectMode: SubjectMode,
): { template: string; envVar: string } | null {
  const modeVar = `WEDDING_SNAP_PROMPT_${subjectMode.toUpperCase()}`;
  const modeVal = process.env[modeVar]?.trim();
  if (modeVal) return { template: modeVal, envVar: modeVar };
  return null;
}

export function describeTemplate(
  subjectMode: SubjectMode,
  venue: VenueInfo,
  store?: PromptTemplateStore,
): PromptTemplateCell {
  const env = envOverride(subjectMode);
  if (env) {
    return {
      subjectMode,
      resolved: interpolateVenue(env.template, venue),
      template: env.template,
      resolvedKo: null,
      source: "env-mode",
      envVar: env.envVar,
      editorSeed: env.template,
    };
  }
  const db = store?.get(subjectMode);
  if (db !== undefined) {
    return {
      subjectMode,
      resolved: interpolateVenue(db, venue),
      template: db,
      resolvedKo: null,
      source: "db",
      envVar: null,
      editorSeed: db,
    };
  }
  return {
    subjectMode,
    resolved: templateDefault(subjectMode, venue),
    template: null,
    resolvedKo: templateDefaultKo(subjectMode, venue),
    source: "computed",
    envVar: null,
    editorSeed: templateSeed(subjectMode),
  };
}

export function resolveTemplate(
  subjectMode: SubjectMode,
  venue: VenueInfo,
  store?: PromptTemplateStore,
) {
  return describeTemplate(subjectMode, venue, store).resolved;
}

// ---------------------------------------------------------------------------
// Admin-facing descriptors
// ---------------------------------------------------------------------------

export const DEFAULT_SAMPLE_VENUE: { title: string; category: string } = {
  title: "그랜드 하얏트 서울",
  category: "호텔 웨딩홀",
};

export type ModePromptMatrix = {
  subjectMode: SubjectMode;
  imageInputs: string[]; // images.edit input order for this mode
  template: PromptTemplateCell;
};

export type PromptMatrixData = {
  modes: ModePromptMatrix[];
  sampleVenue: { title: string; category: string };
};

export function describePromptMatrix(
  store?: PromptTemplateStore,
  sampleVenue: { title: string; category: string } = DEFAULT_SAMPLE_VENUE,
): PromptMatrixData {
  const modes = SUBJECT_MODES.map((subjectMode) => ({
    subjectMode,
    imageInputs: IMAGE_INPUTS[subjectMode],
    template: describeTemplate(subjectMode, sampleVenue, store),
  }));
  return { modes, sampleVenue };
}

export type OpenAIConfigInfo = {
  endpoint: string; // e.g. "images.edit"
  model: { value: string; envVar: string; isDefault: boolean };
  size: { value: string; envVar: string; isDefault: boolean };
  quality: { value: string; envVar: string; isDefault: boolean };
  background: string;
  outputFormat: string;
  baseUrlConfigured: boolean;
  imagesPerJob: number;
};

export function describeOpenAIConfig(): OpenAIConfigInfo {
  const model = process.env.OPENAI_IMAGE_MODEL;
  const size = process.env.OPENAI_IMAGE_SIZE;
  const quality = process.env.OPENAI_IMAGE_QUALITY;
  return {
    endpoint: "images.edit",
    model: { value: model ?? "gpt-image-2", envVar: "OPENAI_IMAGE_MODEL", isDefault: model === undefined },
    size: { value: size ?? "1024x1536", envVar: "OPENAI_IMAGE_SIZE", isDefault: size === undefined },
    quality: { value: quality ?? "medium", envVar: "OPENAI_IMAGE_QUALITY", isDefault: quality === undefined },
    background: "opaque",
    outputFormat: "jpeg",
    baseUrlConfigured: Boolean(process.env.OPENAI_BASE_URL?.trim()),
    imagesPerJob: GENERATED_IMAGES_PER_JOB,
  };
}
