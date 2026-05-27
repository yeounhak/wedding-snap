import type { User } from "@supabase/supabase-js";

import type { GenerateJobRecord } from "./generate-jobs";
import { createServerSupabaseClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";

export type GenerateAccessReservation =
  | {
      allowed: true;
      accessMode: "anonymous_watermarked";
      requiresWatermark: true;
      quotaWindowId: string;
      userId: null;
      creditLedgerId: null;
      creditsRemaining: undefined;
    }
  | {
      allowed: true;
      accessMode: "credit_clean";
      requiresWatermark: false;
      quotaWindowId: null;
      userId: string;
      creditLedgerId: string;
      creditsRemaining: number;
    }
  | {
      allowed: false;
      code: "LOGIN_REQUIRED" | "CREDIT_REQUIRED" | "RATE_LIMITED";
      status: number;
      message: string;
      creditsRemaining?: number;
    };

export type Eligibility = {
  canGenerate: boolean;
  mode: "anonymous_watermarked" | "credit_clean" | "blocked";
  watermarkRequired: boolean;
  anonymousUsed: boolean;
  creditsRemaining: number;
  loginUnlockAvailable: boolean;
  reason?: "LOGIN_REQUIRED" | "CREDIT_REQUIRED" | "RATE_LIMITED";
};

const ANONYMOUS_IP_DAILY_LIMIT = Number(
  process.env.WEDDING_SNAP_ANONYMOUS_IP_DAILY_LIMIT ?? "6",
);

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function reserveGenerateAccess(params: {
  user: User | null;
  deviceHash: string;
  ipPrefixHash: string | null;
}): Promise<GenerateAccessReservation> {
  if (params.user) {
    const creditReservation = await reserveCredit(params.user.id);
    if (creditReservation.allowed) {
      return {
        allowed: true,
        accessMode: "credit_clean",
        requiresWatermark: false,
        quotaWindowId: null,
        userId: params.user.id,
        creditLedgerId: creditReservation.creditLedgerId,
        creditsRemaining: creditReservation.balanceAfter,
      };
    }

    return {
      allowed: false,
      code: "CREDIT_REQUIRED",
      status: 402,
      message: "크레딧을 구매하면 워터마크 없이 더 만들 수 있어요.",
      creditsRemaining: creditReservation.balanceAfter,
    };
  }

  if (params.ipPrefixHash) {
    const recentIpCount = await getRecentAnonymousIpCount(params.ipPrefixHash);
    if (recentIpCount >= ANONYMOUS_IP_DAILY_LIMIT) {
      return {
        allowed: false,
        code: "RATE_LIMITED",
        status: 429,
        message: "요청이 많아 카카오 로그인 후 이용해주세요.",
      };
    }
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("reserve_anonymous_generation", {
    p_device_hash: params.deviceHash,
    p_ip_prefix_hash: params.ipPrefixHash,
    p_window_months: 3,
  });

  if (error) throw error;

  const reservation = Array.isArray(data) ? data[0] : data;
  if (reservation?.allowed && reservation.quota_window_id) {
    return {
      allowed: true,
      accessMode: "anonymous_watermarked",
      requiresWatermark: true,
      quotaWindowId: reservation.quota_window_id,
      userId: null,
      creditLedgerId: null,
      creditsRemaining: undefined,
    };
  }

  return {
    allowed: false,
    code: "LOGIN_REQUIRED",
    status: 401,
    message:
      "무료 생성은 기기당 3개월에 1번만 가능합니다. 카카오 로그인 후 이용해주세요.",
  };
}

export async function getEligibility(params: {
  user: User | null;
  deviceHash: string;
  ipPrefixHash: string | null;
}): Promise<Eligibility> {
  const [anonymousUsed, creditsRemaining, loginUnlockAvailable, recentIpCount] =
    await Promise.all([
      hasActiveAnonymousUsage(params.deviceHash),
      params.user ? getCreditBalance(params.user.id) : Promise.resolve(0),
      params.user
        ? hasUnlockableAnonymousJob(params.user.id, params.deviceHash)
        : Promise.resolve(false),
      params.ipPrefixHash
        ? getRecentAnonymousIpCount(params.ipPrefixHash)
        : Promise.resolve(0),
    ]);

  if (params.user && creditsRemaining > 0) {
    return {
      canGenerate: true,
      mode: "credit_clean",
      watermarkRequired: false,
      anonymousUsed,
      creditsRemaining,
      loginUnlockAvailable,
    };
  }

  if (params.user) {
    return {
      canGenerate: false,
      mode: "blocked",
      watermarkRequired: false,
      anonymousUsed,
      creditsRemaining,
      loginUnlockAvailable,
      reason: "CREDIT_REQUIRED",
    };
  }

  if (params.ipPrefixHash && recentIpCount >= ANONYMOUS_IP_DAILY_LIMIT) {
    return {
      canGenerate: false,
      mode: "blocked",
      watermarkRequired: true,
      anonymousUsed,
      creditsRemaining: 0,
      loginUnlockAvailable: false,
      reason: "RATE_LIMITED",
    };
  }

  return {
    canGenerate: !anonymousUsed,
    mode: anonymousUsed ? "blocked" : "anonymous_watermarked",
    watermarkRequired: true,
    anonymousUsed,
    creditsRemaining: 0,
    loginUnlockAvailable: false,
    reason: anonymousUsed ? "LOGIN_REQUIRED" : undefined,
  };
}

export async function getCreditBalance(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_user_credit_balance", {
    p_user_id: userId,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export async function canReadJob(params: {
  record: GenerateJobRecord;
  user: User | null;
  deviceHash: string;
}) {
  const { record, user, deviceHash } = params;

  if (record.access.userId && user?.id === record.access.userId) {
    return true;
  }

  if (
    record.access.mode === "anonymous_watermarked" &&
    record.access.anonymousDeviceHash === deviceHash
  ) {
    return true;
  }

  return canReadCleanJob({ record, user });
}

export async function canReadCleanJob(params: {
  record: GenerateJobRecord;
  user: User | null;
}) {
  const { record, user } = params;
  if (!user) return false;

  if (record.access.userId === user.id && record.access.mode === "credit_clean") {
    return true;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("job_unlocks")
    .select("id")
    .eq("job_id", record.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function unlockAnonymousJob(params: {
  jobId: string;
  userId: string;
  deviceHash: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("unlock_anonymous_job", {
    p_job_id: params.jobId,
    p_user_id: params.userId,
    p_device_hash: params.deviceHash,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(result?.allowed),
    reason: typeof result?.reason === "string" ? result.reason : null,
  };
}

async function reserveCredit(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("reserve_credit_generation", {
    p_user_id: userId,
  });

  if (error) throw error;

  const reservation = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(reservation?.allowed),
    creditLedgerId:
      typeof reservation?.credit_ledger_id === "string"
        ? reservation.credit_ledger_id
        : null,
    balanceAfter: Number(reservation?.balance_after ?? 0),
  };
}

async function hasActiveAnonymousUsage(deviceHash: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("generation_quota_windows")
    .select("used_count, window_ends_at")
    .eq("subject_type", "anonymous_device")
    .eq("subject_key", deviceHash)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;

  return Number(data.used_count) >= 1 && new Date(data.window_ends_at) > new Date();
}

async function hasUnlockableAnonymousJob(userId: string, deviceHash: string) {
  const admin = createSupabaseAdminClient();
  const { data: existingUnlock, error: existingError } = await admin
    .from("job_unlocks")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingUnlock) return false;

  const { data, error } = await admin
    .from("generation_jobs")
    .select("id")
    .eq("access_mode", "anonymous_watermarked")
    .eq("anonymous_device_hash", deviceHash)
    .eq("status", "succeeded")
    .not("clean_object_path", "is", null)
    .limit(1);

  if (error) throw error;
  return Boolean(data?.length);
}

async function getRecentAnonymousIpCount(ipPrefixHash: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("access_mode", "anonymous_watermarked")
    .eq("ip_prefix_hash", ipPrefixHash)
    .gte("created_at", since);

  if (error) throw error;
  return count ?? 0;
}
