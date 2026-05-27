import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser, unlockAnonymousJob } from "@/app/_lib/access-control";
import {
  attachDeviceCookie,
  getOrCreateDeviceIdentity,
} from "@/app/_lib/device-identity";
import { publicJob, readJobRecord } from "@/app/_lib/generate-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const device = getOrCreateDeviceIdentity(request);
  const user = await getCurrentUser();
  if (!user) {
    return attachDeviceCookie(
      NextResponse.json(
        {
          code: "LOGIN_REQUIRED",
          error: "카카오 로그인 후 워터마크를 제거할 수 있어요.",
        },
        { status: 401 },
      ),
      request,
      device,
    );
  }

  const { jobId } = await params;
  const unlock = await unlockAnonymousJob({
    jobId,
    userId: user.id,
    deviceHash: device.deviceHash,
  });

  if (!unlock.allowed) {
    return attachDeviceCookie(
      NextResponse.json(
        {
          code: unlock.reason ?? "UNLOCK_FAILED",
          error: unlockErrorMessage(unlock.reason),
        },
        { status: 403 },
      ),
      request,
      device,
    );
  }

  const record = await readJobRecord(jobId);
  if (!record) {
    return attachDeviceCookie(
      NextResponse.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 }),
      request,
      device,
    );
  }

  return attachDeviceCookie(
    NextResponse.json(publicJob(record, { variant: "clean" })),
    request,
    device,
  );
}

function unlockErrorMessage(reason: string | null) {
  if (reason === "login_unlock_used") {
    return "로그인 기념 워터마크 제거 혜택은 이미 사용했어요.";
  }
  if (reason === "device_mismatch") {
    return "처음 이미지를 만든 기기에서만 워터마크를 제거할 수 있어요.";
  }
  if (reason === "job_not_ready") {
    return "이미지가 준비된 뒤 워터마크를 제거할 수 있어요.";
  }
  return "워터마크를 제거하지 못했습니다.";
}
