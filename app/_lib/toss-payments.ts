export type PaymentOrderResponse = {
  orderId: string;
  orderName: string;
  amount: number;
  currency: "KRW";
  creditAmount?: number;
  customerKey: string;
  clientKey: string;
  successUrl: string;
  failUrl: string;
};

/**
 * Create a credit order and hand off to the Toss payment window. On success the
 * browser navigates to Toss, so this never resolves in the happy path — callers
 * only see it reject when the order request or SDK fails.
 *
 * `returnTo` is an internal path the user should land on after payment (defaults
 * to "/"); the server validates it before threading it into the Toss callbacks.
 */
export async function startCreditPurchase(options: { returnTo?: string } = {}) {
  const order = await createCreditOrder(options.returnTo);
  await requestTossPayment(order);
}

async function createCreditOrder(returnTo?: string): Promise<PaymentOrderResponse> {
  const response = await fetch("/api/payments/toss/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(returnTo ? { returnTo } : {}),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `결제 요청 실패 (${response.status})`);
  }

  return (await response.json()) as PaymentOrderResponse;
}

export async function requestTossPayment(order: PaymentOrderResponse) {
  await loadTossPaymentsSdk();
  if (!window.TossPayments) {
    throw new Error("토스페이먼츠 SDK를 불러오지 못했습니다");
  }

  const tossPayments = window.TossPayments(order.clientKey);
  const payment = tossPayments.payment({ customerKey: order.customerKey });
  await payment.requestPayment({
    method: "CARD",
    amount: { value: order.amount, currency: order.currency },
    orderId: order.orderId,
    orderName: order.orderName,
    successUrl: order.successUrl,
    failUrl: order.failUrl,
  });
}

async function loadTossPaymentsSdk() {
  if (window.TossPayments) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("toss-payments-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("SDK load failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "toss-payments-sdk";
    script.src = "https://js.tosspayments.com/v2/standard";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SDK load failed"));
    document.head.appendChild(script);
  });
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      payment: (params: { customerKey: string }) => {
        requestPayment: (params: {
          method: "CARD";
          amount: { value: number; currency: "KRW" };
          orderId: string;
          orderName: string;
          successUrl: string;
          failUrl: string;
        }) => Promise<void>;
      };
    };
  }
}
