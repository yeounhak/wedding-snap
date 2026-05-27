import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { canReadCleanJob, canReadJob, getCurrentUser } from "@/app/_lib/access-control";
import {
  attachDeviceCookie,
  getOrCreateDeviceIdentity,
} from "@/app/_lib/device-identity";
import { publicJob, readJobRecord } from "@/app/_lib/generate-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const device = getOrCreateDeviceIdentity(request);
  const user = await getCurrentUser();
  const { jobId } = await params;
  const record = await readJobRecord(jobId).catch(() => null);
  if (!record) {
    return attachDeviceCookie(
      NextResponse.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 }),
      request,
      device,
    );
  }

  if (!(await canReadJob({ record, user, deviceHash: device.deviceHash }))) {
    return attachDeviceCookie(
      NextResponse.json({ error: "작업을 볼 권한이 없습니다" }, { status: 403 }),
      request,
      device,
    );
  }

  const canReadClean = await canReadCleanJob({ record, user });
  const variant = canReadClean ? "clean" : "watermarked";

  return attachDeviceCookie(
    NextResponse.json(publicJob(record, { variant })),
    request,
    device,
  );
}
