import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "./supabase/admin";

export type GenerateJobStatus = "queued" | "running" | "succeeded" | "failed";

export type GenerateJobAccessMode = "anonymous_watermarked" | "credit_clean";

export type GenerateJobRecord = {
  id: string;
  status: GenerateJobStatus;
  createdAt: string;
  updatedAt: string;
  access: {
    mode: GenerateJobAccessMode;
    requiresWatermark: boolean;
    userId: string | null;
    anonymousDeviceHash: string | null;
    ipPrefixHash: string | null;
    quotaWindowId: string | null;
    creditLedgerId: string | null;
  };
  input: {
    maleObjectPath: string;
    maleMimeType: string;
    femaleObjectPath: string;
    femaleMimeType: string;
  };
  result?: GenerateJobResult;
  error?: string;
};

export type GenerateJobResult = {
  cleanObjectPath: string;
  watermarkedObjectPath: string;
  mimeType: string;
  model: string;
  size: string;
  quality: string;
};

export type PublicGenerateJob = {
  jobId: string;
  status: GenerateJobStatus;
  resultUrl?: string;
  error?: string;
  watermarkRequired?: boolean;
  creditsRemaining?: number;
};

type CreateGenerateJobParams = {
  male: File;
  female: File;
  accessMode: GenerateJobAccessMode;
  requiresWatermark: boolean;
  userId?: string | null;
  anonymousDeviceHash?: string | null;
  ipPrefixHash?: string | null;
  quotaWindowId?: string | null;
  creditLedgerId?: string | null;
};

type JobRow = {
  id: string;
  status: GenerateJobStatus;
  access_mode: GenerateJobAccessMode;
  requires_watermark: boolean;
  user_id: string | null;
  anonymous_device_hash: string | null;
  ip_prefix_hash: string | null;
  quota_window_id: string | null;
  credit_ledger_id: string | null;
  input_male_object_path: string;
  input_male_mime_type: string;
  input_female_object_path: string;
  input_female_mime_type: string;
  clean_object_path: string | null;
  watermarked_object_path: string | null;
  result_mime_type: string | null;
  model: string | null;
  size: string | null;
  quality: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

const JOBS_BUCKET = process.env.WEDDING_SNAP_STORAGE_BUCKET ?? "wedding-snap-jobs";

const SUPPORTED_INPUTS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export function validateJobId(jobId: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(jobId)) {
    throw new Error("Invalid job id");
  }
}

export function getJobWorkflowId(jobId: string) {
  validateJobId(jobId);
  return `wedding-snap-image-${jobId}`;
}

export function publicJob(
  record: GenerateJobRecord,
  options: {
    variant?: "clean" | "watermarked";
    creditsRemaining?: number;
  } = {},
): PublicGenerateJob {
  const variant =
    options.variant ?? (record.access.requiresWatermark ? "watermarked" : "clean");
  const resultUrl =
    record.status === "succeeded" && record.result
      ? `/api/generate/${record.id}/image?variant=${variant}`
      : undefined;

  return {
    jobId: record.id,
    status: record.status,
    resultUrl,
    error: record.error,
    watermarkRequired: variant === "watermarked" && record.access.requiresWatermark,
    creditsRemaining: options.creditsRemaining,
  };
}

export function validateGenerateInputFiles(files: { male: File; female: File }) {
  validateInputFile(files.male);
  validateInputFile(files.female);
}

export async function createGenerateJob(params: CreateGenerateJobParams) {
  validateGenerateInputFiles({ male: params.male, female: params.female });

  const id = randomUUID();
  const maleMimeType = normalizeMime(params.male.type);
  const femaleMimeType = normalizeMime(params.female.type);
  const maleObjectPath = getInputObjectPath(id, "male", maleMimeType);
  const femaleObjectPath = getInputObjectPath(id, "female", femaleMimeType);

  await uploadFileObject(maleObjectPath, params.male, maleMimeType);
  await uploadFileObject(femaleObjectPath, params.female, femaleMimeType);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("generation_jobs")
    .insert({
      id,
      status: "queued",
      access_mode: params.accessMode,
      requires_watermark: params.requiresWatermark,
      user_id: params.userId ?? null,
      anonymous_device_hash: params.anonymousDeviceHash ?? null,
      ip_prefix_hash: params.ipPrefixHash ?? null,
      quota_window_id: params.quotaWindowId ?? null,
      credit_ledger_id: params.creditLedgerId ?? null,
      input_male_object_path: maleObjectPath,
      input_male_mime_type: maleMimeType,
      input_female_object_path: femaleObjectPath,
      input_female_mime_type: femaleMimeType,
    })
    .select("*")
    .single();

  if (error) {
    await deleteJobObjects([maleObjectPath, femaleObjectPath]).catch(() => undefined);
    throw error;
  }

  if (params.creditLedgerId) {
    await admin
      .from("generation_credits")
      .update({ related_job_id: id })
      .eq("id", params.creditLedgerId);
  }

  return rowToRecord(data as JobRow);
}

export async function readJobRecord(jobId: string) {
  validateJobId(jobId);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return rowToRecord(data as JobRow);
}

export async function markJobRunning(jobId: string) {
  await updateJobRecord(jobId, {
    status: "running",
    error: null,
  });
}

export async function markJobSucceeded(jobId: string, result: GenerateJobResult) {
  await updateJobRecord(jobId, {
    status: "succeeded",
    clean_object_path: result.cleanObjectPath,
    watermarked_object_path: result.watermarkedObjectPath,
    result_mime_type: result.mimeType,
    model: result.model,
    size: result.size,
    quality: result.quality,
    error: null,
  });
}

export async function markJobFailed(jobId: string, error: string) {
  const record = await readJobRecord(jobId);

  await updateJobRecord(jobId, {
    status: "failed",
    error,
  });

  if (record?.access.creditLedgerId) {
    await refundCreditReservation(
      record.access.creditLedgerId,
      jobId,
      "generation_failed",
    ).catch(() => undefined);
  }
}

export async function refundCreditReservation(
  creditLedgerId: string,
  jobId: string | null,
  note: string,
) {
  const admin = createSupabaseAdminClient();
  const { data: credit, error: creditError } = await admin
    .from("generation_credits")
    .select("user_id, delta, reason")
    .eq("id", creditLedgerId)
    .maybeSingle();

  if (creditError) throw creditError;
  if (!credit || credit.delta >= 0 || credit.reason !== "generation_reserve") {
    return;
  }

  if (jobId) {
    const { data: existing, error: existingError } = await admin
      .from("generation_credits")
      .select("id")
      .eq("related_job_id", jobId)
      .eq("reason", "generation_refund")
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return;
  }

  const { error } = await admin.from("generation_credits").insert({
    user_id: credit.user_id,
    delta: Math.abs(credit.delta),
    reason: "generation_refund",
    related_job_id: jobId,
    note,
  });

  if (error) throw error;
}

export async function uploadJobObject(
  objectPath: string,
  data: Buffer,
  contentType: string,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(JOBS_BUCKET).upload(objectPath, data, {
    contentType,
    upsert: true,
  });

  if (error) throw error;
}

export async function downloadJobObject(objectPath: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(JOBS_BUCKET)
    .download(objectPath);

  if (error) throw error;
  if (!data) {
    throw new Error(`Storage object not found: ${objectPath}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

export function getResultObjectPath(jobId: string, variant: "clean" | "watermarked") {
  validateJobId(jobId);
  return `jobs/${jobId}/result/${variant}.jpg`;
}

function validateInputFile(file: File) {
  const mimeType = normalizeMime(file.type);
  const extension = SUPPORTED_INPUTS.get(mimeType);
  if (!extension) {
    throw new Error("JPG, PNG, WEBP 이미지만 업로드할 수 있습니다");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("이미지는 50MB보다 작아야 합니다");
  }
}

async function updateJobRecord(jobId: string, values: Partial<JobRow>) {
  validateJobId(jobId);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("generation_jobs").update(values).eq("id", jobId);
  if (error) {
    throw error;
  }
}

async function uploadFileObject(
  objectPath: string,
  file: File,
  contentType: string,
) {
  await uploadJobObject(
    objectPath,
    Buffer.from(await file.arrayBuffer()),
    contentType,
  );
}

async function deleteJobObjects(objectPaths: string[]) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(JOBS_BUCKET).remove(objectPaths);
  if (error) throw error;
}

function getInputObjectPath(
  jobId: string,
  role: "male" | "female",
  mimeType: string,
) {
  validateJobId(jobId);
  const extension = SUPPORTED_INPUTS.get(normalizeMime(mimeType));
  if (!extension) {
    throw new Error("JPG, PNG, WEBP 이미지만 업로드할 수 있습니다");
  }

  return `jobs/${jobId}/input/${role}${extension}`;
}

function rowToRecord(row: JobRow): GenerateJobRecord {
  const result =
    row.clean_object_path &&
    row.watermarked_object_path &&
    row.result_mime_type &&
    row.model &&
    row.size &&
    row.quality
      ? {
          cleanObjectPath: row.clean_object_path,
          watermarkedObjectPath: row.watermarked_object_path,
          mimeType: row.result_mime_type,
          model: row.model,
          size: row.size,
          quality: row.quality,
        }
      : undefined;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    access: {
      mode: row.access_mode,
      requiresWatermark: row.requires_watermark,
      userId: row.user_id,
      anonymousDeviceHash: row.anonymous_device_hash,
      ipPrefixHash: row.ip_prefix_hash,
      quotaWindowId: row.quota_window_id,
      creditLedgerId: row.credit_ledger_id,
    },
    input: {
      maleObjectPath: row.input_male_object_path,
      maleMimeType: row.input_male_mime_type,
      femaleObjectPath: row.input_female_object_path,
      femaleMimeType: row.input_female_mime_type,
    },
    result,
    error: row.error ?? undefined,
  };
}

function normalizeMime(mimeType: string) {
  return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
}
