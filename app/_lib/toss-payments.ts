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

export type TossOrderFormWidget = {
  widgets: TossWidgets;
};

export type TossOrderFormWidgetLease = {
  ready: Promise<TossOrderFormWidget>;
  release: () => void;
};

let orderFormRecord: OrderFormRecord | null = null;

export async function createCreditOrder(
  returnTo?: string,
): Promise<PaymentOrderResponse> {
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

export function acquireTossOrderFormWidget(params: {
  clientKey: string;
  customerKey: string;
  amount: number;
  currency: "KRW";
  paymentMethodsSelector: string;
  agreementSelector: string;
}): TossOrderFormWidgetLease {
  const key = getOrderFormWidgetKey(params);
  if (orderFormRecord && orderFormRecord.key !== key) {
    if (orderFormRecord.refCount > 0) {
      return {
        ready: Promise.reject(
          new Error("이미 다른 결제위젯이 렌더링 중입니다."),
        ),
        release: () => undefined,
      };
    }
    scheduleOrderFormDestroy(orderFormRecord, 0);
    orderFormRecord = null;
  }

  orderFormRecord ??= createOrderFormRecord(key, params);
  orderFormRecord.refCount += 1;
  if (orderFormRecord.destroyTimer) {
    window.clearTimeout(orderFormRecord.destroyTimer);
    orderFormRecord.destroyTimer = null;
  }

  const record = orderFormRecord;
  let released = false;
  return {
    ready: record.ready,
    release: () => {
      if (released) return;
      released = true;
      record.refCount = Math.max(0, record.refCount - 1);
      if (record.refCount === 0) {
        scheduleOrderFormDestroy(record, 250);
      }
    },
  };
}

async function renderTossOrderFormWidget(params: {
  clientKey: string;
  customerKey: string;
  amount: number;
  currency: "KRW";
  paymentMethodsSelector: string;
  agreementSelector: string;
}): Promise<TossOrderFormWidgetInternal> {
  await loadTossPaymentsScript();
  if (!window.TossPayments) {
    throw new Error("토스페이먼츠 결제위젯 스크립트를 불러오지 못했습니다");
  }

  const tossPayments = window.TossPayments(params.clientKey);
  const widgets = tossPayments.widgets({ customerKey: params.customerKey });

  await widgets.setAmount({
    value: params.amount,
    currency: params.currency,
  });

  let paymentMethods: TossWidgetControl | null = null;
  let agreement: TossWidgetControl | null = null;

  try {
    paymentMethods = await widgets.renderPaymentMethods({
      selector: params.paymentMethodsSelector,
    });
    agreement = await widgets.renderAgreement({
      selector: params.agreementSelector,
    });
  } catch (error) {
    await destroyWidgetControls([paymentMethods, agreement]);
    throw error;
  }

  return {
    widgets,
    controls: [paymentMethods, agreement].filter(
      (control): control is TossWidgetControl => control !== null,
    ),
  };
}

export async function requestTossOrderPayment(
  checkout: TossOrderFormWidget,
  order: PaymentOrderResponse,
) {
  await checkout.widgets.setAmount({
    value: order.amount,
    currency: order.currency,
  });
  await checkout.widgets.requestPayment({
    orderId: order.orderId,
    orderName: order.orderName,
    successUrl: order.successUrl,
    failUrl: order.failUrl,
  });
}

export function redirectToPaymentFail(order: PaymentOrderResponse, error: unknown) {
  const url = new URL(order.failUrl);
  url.searchParams.set("orderId", order.orderId);
  url.searchParams.set("code", "WIDGET_REQUEST_FAILED");
  url.searchParams.set(
    "message",
    error instanceof Error ? error.message : "결제 요청에 실패했습니다.",
  );
  window.location.assign(url.toString());
}

async function destroyWidgetControls(
  controls: Array<TossWidgetControl | null>,
) {
  await Promise.allSettled(
    controls.map((control) => Promise.resolve(control?.destroy())),
  );
}

function createOrderFormRecord(
  key: string,
  params: Parameters<typeof acquireTossOrderFormWidget>[0],
): OrderFormRecord {
  const record: OrderFormRecord = {
    key,
    ready: Promise.resolve().then(() => renderTossOrderFormWidget(params)),
    refCount: 0,
    destroyTimer: null,
  };

  record.ready
    .then((checkout) => {
      record.checkout = checkout;
    })
    .catch(() => {
      if (orderFormRecord === record) {
        orderFormRecord = null;
      }
    });

  return record;
}

function scheduleOrderFormDestroy(record: OrderFormRecord, delayMs: number) {
  if (record.destroyTimer) {
    window.clearTimeout(record.destroyTimer);
  }

  record.destroyTimer = window.setTimeout(() => {
    record.destroyTimer = null;
    if (record.refCount > 0) return;

    void record.ready
      .then((checkout) => destroyWidgetControls(checkout.controls))
      .catch(() => undefined)
      .finally(() => {
        if (orderFormRecord === record && record.refCount === 0) {
          orderFormRecord = null;
        }
      });
  }, delayMs);
}

function getOrderFormWidgetKey(params: {
  clientKey: string;
  customerKey: string;
  amount: number;
  currency: "KRW";
  paymentMethodsSelector: string;
  agreementSelector: string;
}) {
  return [
    params.clientKey,
    params.customerKey,
    params.amount,
    params.currency,
    params.paymentMethodsSelector,
    params.agreementSelector,
  ].join("|");
}

async function loadTossPaymentsScript() {
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
      widgets: (params: { customerKey: string }) => TossWidgets;
    };
  }
}

type TossWidgetControl = {
  destroy: () => void | Promise<void>;
};

type TossOrderFormWidgetInternal = TossOrderFormWidget & {
  controls: TossWidgetControl[];
};

type OrderFormRecord = {
  key: string;
  ready: Promise<TossOrderFormWidgetInternal>;
  checkout?: TossOrderFormWidgetInternal;
  refCount: number;
  destroyTimer: number | null;
};

type TossWidgets = {
  setAmount: (amount: {
    value: number;
    currency: "KRW";
  }) => Promise<void>;
  renderPaymentMethods: (params: {
    selector: string;
    variantKey?: string;
  }) => Promise<TossWidgetControl>;
  renderAgreement: (params: {
    selector: string;
    variantKey?: string;
  }) => Promise<TossWidgetControl>;
  requestPayment: (params: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
};
