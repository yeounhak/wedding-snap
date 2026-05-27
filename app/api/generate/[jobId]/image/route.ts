import type { NextRequest } from "next/server";

import {
  canReadCleanJob,
  canReadJob,
  getCurrentUser,
} from "@/app/_lib/access-control";
import { getOrCreateDeviceIdentity } from "@/app/_lib/device-identity";
import { downloadJobObject, readJobRecord } from "@/app/_lib/generate-jobs";

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
  if (!record?.result) {
    return Response.json(
      { error: "이미지가 아직 준비되지 않았습니다" },
      { status: 404 },
    );
  }

  const requestedVariant = request.nextUrl.searchParams.get("variant");
  const wantsClean = requestedVariant === "clean";
  const [canReadClean, canReadAny] = await Promise.all([
    canReadCleanJob({ record, user }),
    canReadJob({ record, user, deviceHash: device.deviceHash }),
  ]);

  if (wantsClean && !canReadClean) {
    return Response.json(
      { error: "워터마크 없는 이미지를 볼 권한이 없습니다" },
      { status: 403 },
    );
  }

  if (!wantsClean && !canReadAny && !record.sharedAt) {
    return Response.json(
      { error: "이미지를 볼 권한이 없습니다" },
      { status: 403 },
    );
  }

  const objectPath = wantsClean
    ? record.result.cleanObjectPath
    : record.result.watermarkedObjectPath;
  const data = await downloadJobObject(objectPath).catch(() => null);
  if (!data) {
    return Response.json({ error: "이미지를 찾을 수 없습니다" }, { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Length": String(data.byteLength),
      "Content-Type": record.result.mimeType,
    },
  });
}
