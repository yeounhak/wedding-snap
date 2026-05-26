import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";

import { ApplicationFailure } from "@temporalio/client";
import OpenAI from "openai";

import {
  getResultPath,
  markJobFailed as markFailed,
  markJobRunning as markRunning,
  markJobSucceeded as markSucceeded,
  readJobRecord,
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
  let response;
  try {
    response = await openai.images.edit({
      model: MODEL,
      image: [
        createReadStream(record.input.malePath),
        createReadStream(record.input.femalePath),
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
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response did not include image data");
  }

  const resultPath = getResultPath(jobId, OUTPUT_FORMAT);
  await fs.writeFile(resultPath, Buffer.from(b64, "base64"));

  return {
    path: resultPath,
    mimeType: OUTPUT_MIME,
    url: `/api/generate/${jobId}/image`,
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
