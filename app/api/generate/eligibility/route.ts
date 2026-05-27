import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser, getEligibility } from "@/app/_lib/access-control";
import {
  attachDeviceCookie,
  getIpPrefixHash,
  getOrCreateDeviceIdentity,
} from "@/app/_lib/device-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const device = getOrCreateDeviceIdentity(request);
  const user = await getCurrentUser();
  const eligibility = await getEligibility({
    user,
    deviceHash: device.deviceHash,
    ipPrefixHash: getIpPrefixHash(request),
  });

  return attachDeviceCookie(NextResponse.json(eligibility), request, device);
}
