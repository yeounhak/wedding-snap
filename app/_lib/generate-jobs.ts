import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type GenerateJobStatus = "queued" | "running" | "succeeded" | "failed";

export type GenerateJobRecord = {
  id: string;
  status: GenerateJobStatus;
  createdAt: string;
  updatedAt: string;
  input: {
    malePath: string;
    maleMimeType: string;
    femalePath: string;
    femaleMimeType: string;
  };
  result?: GenerateJobResult;
  error?: string;
};

export type GenerateJobResult = {
  path: string;
  mimeType: string;
  url: string;
  model: string;
  size: string;
  quality: string;
};

export type PublicGenerateJob = {
  jobId: string;
  status: GenerateJobStatus;
  resultUrl?: string;
  error?: string;
};

const SUPPORTED_INPUTS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export function getJobsRoot() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".wedding-snap-jobs");
}

export function validateJobId(jobId: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
    throw new Error("Invalid job id");
  }
}

export function getJobWorkflowId(jobId: string) {
  validateJobId(jobId);
  return `wedding-snap-image-${jobId}`;
}

export function publicJob(record: GenerateJobRecord): PublicGenerateJob {
  return {
    jobId: record.id,
    status: record.status,
    resultUrl: record.result?.url,
    error: record.error,
  };
}

export async function createGenerateJob(files: { male: File; female: File }) {
  const id = randomUUID();
  const dir = getJobDir(id);
  await fs.mkdir(dir, { recursive: true });

  const malePath = await saveInputFile(dir, "male", files.male);
  const femalePath = await saveInputFile(dir, "female", files.female);
  const now = new Date().toISOString();
  const record: GenerateJobRecord = {
    id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input: {
      malePath,
      maleMimeType: normalizeMime(files.male.type),
      femalePath,
      femaleMimeType: normalizeMime(files.female.type),
    },
  };

  await writeJobRecord(record);
  return record;
}

export async function readJobRecord(jobId: string) {
  validateJobId(jobId);
  try {
    const raw = await fs.readFile(getJobRecordPath(jobId), "utf8");
    return JSON.parse(raw) as GenerateJobRecord;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function markJobRunning(jobId: string) {
  await updateJobRecord(jobId, (record) => ({
    ...record,
    status: "running",
    error: undefined,
  }));
}

export async function markJobSucceeded(jobId: string, result: GenerateJobResult) {
  await updateJobRecord(jobId, (record) => ({
    ...record,
    status: "succeeded",
    result,
    error: undefined,
  }));
}

export async function markJobFailed(jobId: string, error: string) {
  await updateJobRecord(jobId, (record) => ({
    ...record,
    status: "failed",
    error,
  }));
}

export function getResultPath(jobId: string, format: "png" | "jpeg" | "webp") {
  validateJobId(jobId);
  return path.join(getJobDir(jobId), `result.${format === "jpeg" ? "jpg" : format}`);
}

async function updateJobRecord(
  jobId: string,
  update: (record: GenerateJobRecord) => GenerateJobRecord,
) {
  const record = await readJobRecord(jobId);
  if (!record) {
    throw new Error(`Job not found: ${jobId}`);
  }
  await writeJobRecord({
    ...update(record),
    updatedAt: new Date().toISOString(),
  });
}

async function writeJobRecord(record: GenerateJobRecord) {
  const file = getJobRecordPath(record.id);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

async function saveInputFile(dir: string, role: "male" | "female", file: File) {
  const mimeType = normalizeMime(file.type);
  const extension = SUPPORTED_INPUTS.get(mimeType);
  if (!extension) {
    throw new Error("JPG, PNG, WEBP 이미지만 업로드할 수 있습니다");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("이미지는 50MB보다 작아야 합니다");
  }

  const target = path.join(dir, `${role}${extension}`);
  const data = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(target, data);
  return target;
}

function getJobDir(jobId: string) {
  validateJobId(jobId);
  return path.join(getJobsRoot(), jobId);
}

function getJobRecordPath(jobId: string) {
  return path.join(getJobDir(jobId), "job.json");
}

function normalizeMime(mimeType: string) {
  return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
