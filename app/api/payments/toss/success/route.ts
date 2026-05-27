import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/_lib/access-control";
import {
  confirmTossPayment,
  findPaymentOrder,
  grantCreditsForPaidOrder,
  markPaymentOrderFailed,
} from "@/app/_lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const redirectUrl = new URL("/", url.origin);
  const paymentKey = url.searchParams.get("paymentKey");
  const orderId = url.searchParams.get("orderId");
  const amountParam = url.searchParams.get("amount");
  const user = await getCurrentUser();

  if (!paymentKey || !orderId || !amountParam || !user) {
    redirectUrl.searchParams.set("payment", "failed");
    redirectUrl.searchParams.set("reason", "invalid_payment_callback");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const order = await findPaymentOrder(orderId);
    if (!order || order.user_id !== user.id) {
      throw new Error("결제 주문을 찾을 수 없습니다.");
    }

    if (order.status === "paid") {
      redirectUrl.searchParams.set("payment", "success");
      return NextResponse.redirect(redirectUrl);
    }

    const callbackAmount = Number(amountParam);
    if (!Number.isInteger(callbackAmount) || callbackAmount !== order.amount) {
      await markPaymentOrderFailed({
        orderId,
        code: "AMOUNT_MISMATCH",
        message: "결제 금액이 주문 금액과 다릅니다.",
      });
      throw new Error("결제 금액이 주문 금액과 다릅니다.");
    }

    const tossPayment = await confirmTossPayment({
      paymentKey,
      orderId,
      amount: order.amount,
      idempotencyKey: orderId,
    });

    if (tossPayment.status !== "DONE") {
      throw new Error(`결제가 완료되지 않았습니다: ${tossPayment.status}`);
    }
    if (tossPayment.orderId !== orderId || tossPayment.totalAmount !== order.amount) {
      throw new Error("승인된 결제 정보가 주문 정보와 다릅니다.");
    }

    await grantCreditsForPaidOrder({
      orderId,
      paymentKey,
      tossPayload: tossPayment,
    });

    redirectUrl.searchParams.set("payment", "success");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    await markPaymentOrderFailed({
      orderId,
      code: "CONFIRM_FAILED",
      message: error instanceof Error ? error.message : "결제 승인에 실패했습니다.",
    }).catch(() => undefined);

    redirectUrl.searchParams.set("payment", "failed");
    redirectUrl.searchParams.set(
      "reason",
      error instanceof Error ? error.message : "payment_confirm_failed",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
