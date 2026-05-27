import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ApplicationFailure } from "@temporalio/client";
import OpenAI from "openai";
import sharp from "sharp";

import {
  downloadJobObject,
  getResultObjectPath,
  markJobFailed as markFailed,
  markJobRunning as markRunning,
  markJobSucceeded as markSucceeded,
  readJobRecord,
  uploadJobObject,
  type GenerateJobResult,
} from "../app/_lib/generate-jobs";

const DEFAULT_PROMPT = [
  "Create a polished wedding snap portrait based on the two reference photos.",
  "Preserve each person's facial identity and natural features.",
  "Style them as a bride and groom in elegant wedding attire.",
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
  const malePath = path.join(tempDir, `male${extensionForMime(record.input.maleMimeType)}`);
  const femalePath = path.join(
    tempDir,
    `female${extensionForMime(record.input.femaleMimeType)}`,
  );

  let response;
  try {
    await Promise.all([
      downloadJobObject(record.input.maleObjectPath).then((data) =>
        fs.writeFile(malePath, data),
      ),
      downloadJobObject(record.input.femaleObjectPath).then((data) =>
        fs.writeFile(femalePath, data),
      ),
    ]);

    response = await openai.images.edit({
      model: MODEL,
      image: [
        createReadStream(malePath),
        createReadStream(femalePath),
      ],
      prompt: process.env.WEDDING_SNAP_PROMPT ?? DEFAULT_PROMPT,
      background: "opaque",
      n: 1,
      output_format: OUTPUT_FORMAT,
      quality: QUALITY as "low" | "medium" | "high" | "auto",
      size: SIZE,
    });
  } catch (error) {
    if (error instanceof OpenAI.APIError && error.status < 500) {
      throw ApplicationFailure.nonRetryable(error.message, "OpenAIBadRequest");
    }
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response did not include image data");
  }

  const cleanBuffer = Buffer.from(b64, "base64");
  const watermarkedBuffer = await applyWatermark(cleanBuffer);
  const cleanObjectPath = getResultObjectPath(jobId, "clean");
  const watermarkedObjectPath = getResultObjectPath(jobId, "watermarked");

  await Promise.all([
    uploadJobObject(cleanObjectPath, cleanBuffer, OUTPUT_MIME),
    uploadJobObject(watermarkedObjectPath, watermarkedBuffer, OUTPUT_MIME),
  ]);

  return {
    cleanObjectPath,
    watermarkedObjectPath,
    mimeType: OUTPUT_MIME,
    model: MODEL,
    size: SIZE,
    quality: QUALITY,
  };
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
