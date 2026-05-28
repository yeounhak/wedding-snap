import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ApplicationFailure } from "@temporalio/client";
import OpenAI from "openai";
import sharp from "sharp";

import {
  downloadJobObject,
  GENERATED_IMAGES_PER_JOB,
  getResultObjectPath,
  markJobFailed as markFailed,
  markJobRunning as markRunning,
  markJobSucceeded as markSucceeded,
  readJobRecord,
  uploadJobObject,
  type GenerateJobResult,
} from "../app/_lib/generate-jobs";

const COUPLE_PROMPT = [
  "Create a polished wedding snap portrait based on the two reference photos.",
  "Preserve each person's facial identity and natural features.",
  "Style them as a bride and groom in elegant wedding attire.",
  "Use soft daylight, refined editorial photography, realistic skin texture, and a romantic outdoor wedding atmosphere.",
  "Do not add text, logos, watermarks, extra people, distorted hands, or surreal details.",
].join(" ");

const BRIDE_PROMPT = [
  "Create a polished solo wedding portrait of the bride based on the reference photo.",
  "Preserve her facial identity and natural features.",
  "Style her in an elegant white wedding dress with tasteful bridal styling (subtle veil or bouquet is fine).",
  "Frame as a single-subject editorial wedding portrait — no second person, no groom.",
  "Use soft daylight, refined editorial photography, realistic skin texture, and a romantic outdoor wedding atmosphere.",
  "Do not add text, logos, watermarks, extra people, distorted hands, or surreal details.",
].join(" ");

const GROOM_PROMPT = [
  "Create a polished solo wedding portrait of the groom based on the reference photo.",
  "Preserve his facial identity and natural features.",
  "Style him in an elegant black tuxedo or formal wedding suit with tasteful groom styling.",
  "Frame as a single-subject editorial wedding portrait — no second person, no bride.",
  "Use soft daylight, refined editorial photography, realistic skin texture, and a romantic outdoor wedding atmosphere.",
  "Do not add text, logos, watermarks, extra people, distorted hands, or surreal details.",
].join(" ");

const MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
const SIZE = process.env.OPENAI_IMAGE_SIZE ?? "1024x1536";
const QUALITY = process.env.OPENAI_IMAGE_QUALITY ?? "medium";
const OUTPUT_FORMAT = "jpeg";
const OUTPUT_MIME = "image/jpeg";

export async function markJobRunning(jobId: string) {
  await markRunning(jobId);
}

export async function markJobFailed(jobId: string, message: string) {
  await markFailed(jobId, message);
}

export async function markJobSucceeded(jobId: string, result: GenerateJobResult) {
  await markSucceeded(jobId, result);
}

export async function generateWeddingImage(jobId: string): Promise<GenerateJobResult> {
  const record = await readJobRecord(jobId);
  if (!record) {
    throw new Error(`Job not found: ${jobId}`);
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: getOpenAIBaseURL(),
  });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `wedding-snap-${jobId}-`));
  const subjectMode = record.input.subjectMode;
  const downloads: Array<Promise<string>> = [];

  if (record.input.maleObjectPath && record.input.maleMimeType) {
    const malePath = path.join(
      tempDir,
      `male${extensionForMime(record.input.maleMimeType)}`,
    );
    downloads.push(
      downloadJobObject(record.input.maleObjectPath)
        .then((data) => fs.writeFile(malePath, data))
        .then(() => malePath),
    );
  }
  if (record.input.femaleObjectPath && record.input.femaleMimeType) {
    const femalePath = path.join(
      tempDir,
      `female${extensionForMime(record.input.femaleMimeType)}`,
    );
    downloads.push(
      downloadJobObject(record.input.femaleObjectPath)
        .then((data) => fs.writeFile(femalePath, data))
        .then(() => femalePath),
    );
  }

  let cleanBuffers: Buffer[] = [];
  try {
    const imagePaths = await Promise.all(downloads);
    if (imagePaths.length === 0) {
      throw new Error("Job has no reference photos");
    }

    cleanBuffers = await Promise.all(
      Array.from({ length: GENERATED_IMAGES_PER_JOB }, (_, index) =>
        generateOneImage(openai, imagePaths, subjectMode, index),
      ),
    );
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status < 500) {
      throw ApplicationFailure.nonRetryable(error.message, "OpenAIBadRequest");
    }
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  const watermarkedBuffers = await Promise.all(cleanBuffers.map(applyWatermark));
  const cleanObjectPaths = cleanBuffers.map((_, index) =>
    getResultObjectPath(jobId, "clean", index),
  );
  const watermarkedObjectPaths = cleanBuffers.map((_, index) =>
    getResultObjectPath(jobId, "watermarked", index),
  );

  await Promise.all([
    ...cleanBuffers.map((buffer, index) =>
      uploadJobObject(cleanObjectPaths[index], buffer, OUTPUT_MIME),
    ),
    ...watermarkedBuffers.map((buffer, index) =>
      uploadJobObject(watermarkedObjectPaths[index], buffer, OUTPUT_MIME),
    ),
  ]);

  return {
    cleanObjectPath: cleanObjectPaths[0],
    watermarkedObjectPath: watermarkedObjectPaths[0],
    cleanObjectPaths,
    watermarkedObjectPaths,
    count: cleanBuffers.length,
    mimeType: OUTPUT_MIME,
    model: MODEL,
    size: SIZE,
    quality: QUALITY,
  };
}

async function generateOneImage(
  openai: OpenAI,
  imagePaths: string[],
  subjectMode: "couple" | "bride" | "groom",
  index: number,
) {
  const response = await openai.images.edit({
    model: MODEL,
    image: imagePaths.map((p) => createReadStream(p)),
    prompt: resolvePrompt(subjectMode, index),
    background: "opaque",
    n: 1,
    output_format: OUTPUT_FORMAT,
    quality: QUALITY as "low" | "medium" | "high" | "auto",
    size: SIZE,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`OpenAI image response ${index + 1} did not include image data`);
  }

  return Buffer.from(b64, "base64");
}

function getOpenAIBaseURL() {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  if (!baseURL) return undefined;
  return /^https?:\/\//i.test(baseURL) ? baseURL : `https://${baseURL}`;
}

function resolvePrompt(subjectMode: "couple" | "bride" | "groom", index: number) {
  const promptSlot = process.env[
    `WEDDING_SNAP_PROMPT_${subjectMode.toUpperCase()}_${index + 1}`
  ]?.trim();
  if (promptSlot) return promptSlot;

  if (subjectMode === "bride") {
    return process.env.WEDDING_SNAP_PROMPT_BRIDE ?? BRIDE_PROMPT;
  }
  if (subjectMode === "groom") {
    return process.env.WEDDING_SNAP_PROMPT_GROOM ?? GROOM_PROMPT;
  }
  return (
    process.env.WEDDING_SNAP_PROMPT_COUPLE ??
    process.env.WEDDING_SNAP_PROMPT ??
    COUPLE_PROMPT
  );
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

async function applyWatermark(input: Buffer) {
  const image = sharp(input);
  const metadata = await image.metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;
  const fontSize = Math.max(32, Math.round(width * 0.055));
  const step = Math.max(220, Math.round(width * 0.28));
  const marks: string[] = [];

  for (let y = -height; y < height * 2; y += step) {
    for (let x = -width; x < width * 2; x += step * 1.4) {
      marks.push(
        `<text x="${x}" y="${y}" class="mark">Wedding Snap</text>`,
      );
    }
  }

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .mark {
          fill: rgba(255, 255, 255, 0.58);
          stroke: rgba(0, 0, 0, 0.24);
          stroke-width: 1.5px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: ${fontSize}px;
          font-weight: 700;
          letter-spacing: 0;
        }
      </style>
      <g transform="rotate(-28 ${width / 2} ${height / 2})">${marks.join("")}</g>
      <text x="${width - 32}" y="${height - 34}" text-anchor="end"
        style="fill: rgba(255,255,255,0.92); stroke: rgba(0,0,0,0.32); stroke-width: 2px; font-family: Arial, Helvetica, sans-serif; font-size: ${Math.max(26, Math.round(fontSize * 0.72))}px; font-weight: 700;">
        Wedding Snap
      </text>
    </svg>
  `;

  return sharp(input)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
