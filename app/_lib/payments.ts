import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "./supabase/admin";

export type CreditProduct = {
  sku: string;
  orderName: string;
  amount: number;
  creditAmount: number;
  currency: "KRW";
};

export type TossConfirmResponse = {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  [key: string]: unknown;
};

export function getCreditProduct(): CreditProduct {
  return {
    sku: process.env.WEDDING_SNAP_CREDIT_PACK_SKU ?? "wedding-snap-credit-5",
    orderName: process.env.WEDDING_SNAP_CREDIT_PACK_NAME ?? "웨딩 스냅 5장 크레딧",
    amount: parsePositiveInt(process.env.WEDDING_SNAP_CREDIT_PACK_AMOUNT, 3900),
    creditAmount: parsePositiveInt(
      process.env.WEDDING_SNAP_CREDIT_PACK_CREDITS,
      5,
    ),
    currency: "KRW",
  };
}

export function getTossClientKey() {
  const key = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_TOSS_CLIENT_KEY is not set");
  }
  return key;
}

export function getTossSecretKey() {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) {
    throw new Error("TOSS_SECRET_KEY is not set");
  }
  return key;
}

export function createTossOrderId() {
  return `wsnap-${randomUUID()}`;
}

export function getTossCustomerKey(userId: string) {
  return `user-${userId}`;
}

export async function createPaymentOrder(params: {
  userId: string;
  origin: string;
}) {
  const product = getCreditProduct();
  const clientKey = getTossClientKey();
  const orderId = createTossOrderId();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("payment_orders").insert({
    order_id: orderId,
    user_id: params.userId,
    product_sku: product.sku,
    order_name: product.orderName,
    amount: product.amount,
    currency: product.currency,
    credit_amount: product.creditAmount,
    status: "pending",
  });

  if (error) throw error;

  return {
    orderId,
    orderName: product.orderName,
    amount: product.amount,
    currency: product.currency,
    creditAmount: product.creditAmount,
    customerKey: getTossCustomerKey(params.userId),
    clientKey,
    successUrl: `${params.origin}/api/payments/toss/success`,
    failUrl: `${params.origin}/api/payments/toss/fail`,
  };
}

export async function confirmTossPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
  idempotencyKey: string;
}) {
  const auth = Buffer.from(`${getTossSecretKey()}:`, "utf8").toString("base64");
  const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | TossConfirmResponse
    | { code?: string; message?: string }
    | null;

  if (!response.ok) {
    const message =
      payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : `Toss confirm failed (${response.status})`;
    throw new Error(message);
  }

  return payload as TossConfirmResponse;
}

export async function findPaymentOrder(orderId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("payment_orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function markPaymentOrderFailed(params: {
  orderId: string;
  code: string | null;
  message: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("payment_orders")
    .update({
      status: "failed",
      failure_code: params.code,
      failure_message: params.message,
    })
    .eq("order_id", params.orderId)
    .eq("status", "pending");

  if (error) throw error;
}

export async function grantCreditsForPaidOrder(params: {
  orderId: string;
  paymentKey: string;
  tossPayload: TossConfirmResponse;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("confirm_payment_order", {
    p_order_id: params.orderId,
    p_payment_key: params.paymentKey,
    p_toss_payload: params.tossPayload,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
