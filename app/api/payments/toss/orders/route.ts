import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/app/_lib/access-control";
import { createPaymentOrder } from "@/app/_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      {
        code: "LOGIN_REQUIRED",
        error: "크레딧 구매는 카카오 로그인 후 이용할 수 있어요.",
      },
      { status: 401 },
    );
  }

  const order = await createPaymentOrder({
    userId: user.id,
    origin: request.nextUrl.origin,
  });

  return Response.json(order, { status: 201 });
}
