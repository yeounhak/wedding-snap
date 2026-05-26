import type { NextRequest } from "next/server";

import { publicJob, readJobRecord } from "@/app/_lib/generate-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const record = await readJobRecord(jobId).catch(() => null);
  if (!record) {
    return Response.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 });
  }

  return Response.json(publicJob(record));
}
