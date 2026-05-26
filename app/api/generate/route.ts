import type { NextRequest } from "next/server";

import {
  createGenerateJob,
  markJobFailed,
  publicJob,
} from "@/app/_lib/generate-jobs";
import { startGenerateWorkflow } from "@/app/_lib/temporal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const male = formData.get("male");
  const female = formData.get("female");
  if (!(male instanceof File) || !(female instanceof File)) {
    return Response.json(
      { error: "남자 사진과 여자 사진이 모두 필요합니다" },
      { status: 400 },
    );
  }

  let record;
  try {
    record = await createGenerateJob({ male, female });
    await startGenerateWorkflow(record.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "이미지 생성 작업을 시작하지 못했습니다";
    if (record) {
      await markJobFailed(record.id, message).catch(() => undefined);
    }
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json(publicJob(record), { status: 202 });
}
