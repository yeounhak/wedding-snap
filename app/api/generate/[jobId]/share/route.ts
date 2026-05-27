import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { canReadJob, getCurrentUser } from "@/app/_lib/access-control";
import {
  attachDeviceCookie,
  getOrCreateDeviceIdentity,
} from "@/app/_lib/device-identity";
import { markJobShared, readJobRecord } from "@/app/_lib/generate-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const device = getOrCreateDeviceIdentity(request);
  const user = await getCurrentUser();
  const { jobId } = await params;
  const record = await readJobRecord(jobId).catch(() => null);

  const respond = (body: unknown, init?: ResponseInit) =>
    attachDeviceCookie(NextResponse.json(body, init), request, device);

  if (!record || record.status !== "succeeded" || !record.result) {
    return respond({ error: "공유할 수 있는 사진이 아직 없어요" }, { status: 404 });
  }

  const isOwner = await canReadJob({
    record,
    user,
    deviceHash: device.deviceHash,
  });
  if (!isOwner) {
    return respond({ error: "이 사진을 공유할 권한이 없어요" }, { status: 403 });
  }

  await markJobShared(jobId);

  // Public share page always shows the watermarked variant, regardless of the
  // owner's access mode, to keep the clean image gated.
  return respond({ shareUrl: `/s/${jobId}` });
}
