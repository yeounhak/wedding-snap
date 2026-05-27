import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { markPaymentOrderFailed } from "@/app/_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const orderId = url.searchParams.get("orderId");
  const code = url.searchParams.get("code");
  const message = url.searchParams.get("message");

  if (orderId) {
    await markPaymentOrderFailed({ orderId, code, message }).catch(() => undefined);
  }

  const redirectUrl = new URL("/", url.origin);
  redirectUrl.searchParams.set("payment", "failed");
  if (code) redirectUrl.searchParams.set("code", code);
  if (message) redirectUrl.searchParams.set("reason", message);
  return NextResponse.redirect(redirectUrl);
}
