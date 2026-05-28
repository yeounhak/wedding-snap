"use client";

import { useEffect, useRef, useState } from "react";

import {
  acquireTossOrderFormWidget,
  createCreditOrder,
  redirectToPaymentFail,
  requestTossOrderPayment,
  type PaymentOrderResponse,
  type TossOrderFormWidget,
} from "@/app/_lib/toss-payments";

type Props = {
  returnTo: string;
  clientKey: string;
  customerKey: string;
  amount: number;
  currency: "KRW";
};

const PAYMENT_METHODS_SELECTOR = "#toss-payment-methods";
const AGREEMENT_SELECTOR = "#toss-payment-agreement";

export default function PaymentWidgetCheckout({
  returnTo,
  clientKey,
  customerKey,
  amount,
  currency,
}: Props) {
  const checkoutRef = useRef<TossOrderFormWidget | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const lease = acquireTossOrderFormWidget({
      clientKey,
      customerKey,
      amount,
      currency,
      paymentMethodsSelector: PAYMENT_METHODS_SELECTOR,
      agreementSelector: AGREEMENT_SELECTOR,
    });

    void lease.ready
      .then((checkout) => {
        if (canceled) return;
        checkoutRef.current = checkout;
        setStatus("ready");
      })
      .catch((err) => {
        if (canceled) return;
        checkoutRef.current = null;
        setStatus("error");
        setError(
          err instanceof Error
            ? err.message
            : "결제수단을 불러오지 못했어요",
        );
      });

    return () => {
      canceled = true;
      checkoutRef.current = null;
      lease.release();
    };
  }, [amount, clientKey, currency, customerKey]);

  const onClick = async () => {
    const checkout = checkoutRef.current;
    if (!checkout) {
      setError("결제수단을 아직 불러오는 중이에요");
      return;
    }

    setWorking(true);
    setError(null);

    let order: PaymentOrderResponse | null = null;
    try {
      order = await createCreditOrder(returnTo);
      validateOrderForCurrentWidget(order, { clientKey, customerKey });
      await requestTossOrderPayment(checkout, order);
    } catch (err) {
      setWorking(false);
      if (order) {
        redirectToPaymentFail(order, err);
        return;
      }
      setError(err instanceof Error ? err.message : "결제를 시작하지 못했어요");
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div
        id="toss-payment-methods"
        aria-busy={status === "loading"}
        className="min-h-[220px] overflow-hidden rounded-xl border border-neutral-100 bg-white"
      />
      <div
        id="toss-payment-agreement"
        aria-busy={status === "loading"}
        className="min-h-[86px]"
      />
      <button
        type="button"
        onClick={onClick}
        disabled={working || status !== "ready"}
        className="w-full h-12 rounded-full bg-neutral-900 text-white font-medium flex items-center justify-center active:scale-[0.98] transition disabled:opacity-60"
      >
        {working
          ? "결제 요청 중"
          : status === "ready"
            ? "결제하기"
            : "결제위젯 준비 중"}
      </button>
      {error ? (
        <p className="text-center text-[13px] text-red-500">{error}</p>
      ) : null}
    </div>
  );
}

function validateOrderForCurrentWidget(
  order: PaymentOrderResponse,
  expected: { clientKey: string; customerKey: string },
) {
  if (
    order.clientKey !== expected.clientKey ||
    order.customerKey !== expected.customerKey
  ) {
    throw new Error("결제 주문 정보가 현재 위젯 정보와 다릅니다.");
  }
}
