import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ApplicationFailure } from "@temporalio/client";
import OpenAI, { toFile } from "openai";
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
import { resolveTemplate } from "../app/_lib/prompts";
import { loadPromptTemplates } from "../app/_lib/prompt-templates";

// Prompt defaults + layered env resolution moved to app/_lib/prompts.ts so the
// admin viewer (app/admin/prompts) renders exactly what this worker resolves.
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
  // Load admin-editable prompt overrides once per job. Degrades to an empty
  // store (env + hardcoded defaults) if the table is missing or unreachable.
  const promptStore = await loadPromptTemplates();
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

    // Real-location backdrop (Phase 0 validated): the venue image is fed as the LAST
    // input so gpt-image-2 composites the subject INTO it. Venue is now REQUIRED —
    // every generation has a location, so a job without one fails rather than
    // degrading to a (no longer existing) venue-less prompt.
    if (!record.venue.objectPath) {
      throw ApplicationFailure.nonRetryable(
        "Job has no venue assigned; venue is required for generation",
        "VenueRequired",
      );
    }
    const venuePath = path.join(tempDir, "venue.jpg");
    await fs.writeFile(venuePath, await downloadJobObject(record.venue.objectPath));

    // One prompt per mode; all GENERATED_IMAGES_PER_JOB images use it. Variety
    // comes from each images.edit call being independent (no fixed seed).
    const prompt = resolveTemplate(subjectMode, record.venue, promptStore);
    const editImages = [...imagePaths, venuePath];
    cleanBuffers = await Promise.all(
      Array.from({ length: GENERATED_IMAGES_PER_JOB }, () =>
        generateOneImage(openai, editImages, prompt),
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

async function generateOneImage(openai: OpenAI, images: string[], prompt: string) {
  const response = await openai.images.edit({
    model: MODEL,
    image: await Promise.all(images.map(toUploadable)),
    prompt,
    background: "opaque",
    n: 1,
    output_format: OUTPUT_FORMAT,
    quality: QUALITY as "low" | "medium" | "high" | "auto",
    size: SIZE,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response did not include image data");
  }

  return Buffer.from(b64, "base64");
}

function mimeForPath(p: string) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

// Upload with an explicit filename + mimetype. Raw createReadStream uploads are seen as
// application/octet-stream by api.openai.com (direct), which rejects them with a 400;
// the litellm proxy was lenient. toFile makes it work for both.
async function toUploadable(p: string) {
  return toFile(await fs.readFile(p), path.basename(p), { type: mimeForPath(p) });
}

function getOpenAIBaseURL() {
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  if (!baseURL) return undefined;
  return /^https?:\/\//i.test(baseURL) ? baseURL : `https://${baseURL}`;
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
