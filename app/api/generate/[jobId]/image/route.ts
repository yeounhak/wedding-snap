import { promises as fs } from "node:fs";

import type { NextRequest } from "next/server";

import { readJobRecord } from "@/app/_lib/generate-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const record = await readJobRecord(jobId).catch(() => null);
  if (!record?.result) {
    return Response.json({ error: "이미지가 아직 준비되지 않았습니다" }, { status: 404 });
  }

  const data = await fs.readFile(record.result.path).catch(() => null);
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
