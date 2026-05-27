import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";

import type { NextRequest, NextResponse } from "next/server";

export const DEVICE_COOKIE_NAME = "wedding_snap_device_id";

export type DeviceIdentity = {
  deviceId: string;
  deviceHash: string;
  needsCookie: boolean;
};

const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function getOrCreateDeviceIdentity(request: NextRequest): DeviceIdentity {
  const existing = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
  const deviceId = isValidDeviceId(existing) ? existing : randomUUID();

  return {
    deviceId,
    deviceHash: hashOpaqueValue("device", deviceId),
    needsCookie: deviceId !== existing,
  };
}

export function attachDeviceCookie(
  response: NextResponse,
  request: NextRequest,
  identity: DeviceIdentity,
) {
  if (!identity.needsCookie) return response;

  response.cookies.set(DEVICE_COOKIE_NAME, identity.deviceId, {
    httpOnly: true,
    maxAge: DEVICE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}

export function getIpPrefixHash(request: NextRequest) {
  const rawIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  if (!rawIp) return null;

  const prefix = normalizeIpPrefix(rawIp);
  return prefix ? hashOpaqueValue("ip-prefix", prefix) : null;
}

export function hashOpaqueValue(purpose: string, value: string) {
  return createHmac("sha256", getHashSecret())
    .update(`${purpose}:${value}`)
    .digest("hex");
}

function getHashSecret() {
  const secret =
    process.env.WEDDING_SNAP_DEVICE_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.KAKAO_CLIENT_SECRET;

  if (!secret) {
    throw new Error(
      "WEDDING_SNAP_DEVICE_SECRET, SUPABASE_SECRET_KEY, or KAKAO_CLIENT_SECRET is required",
    );
  }

  return secret;
}

function isValidDeviceId(value: string | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{8,80}$/.test(value));
}

function normalizeIpPrefix(rawIp: string) {
  const ip = rawIp.trim().replace(/^\[|\]$/g, "");
  const version = isIP(ip);

  if (version === 4) {
    const parts = ip.split(".");
    return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0/24` : null;
  }

  if (version === 6) {
    const expanded = ip.split(":").slice(0, 4).join(":");
    return expanded ? `${expanded}::/64` : null;
  }

  return null;
}
