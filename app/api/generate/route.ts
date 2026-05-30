import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getCurrentUser,
  reserveGenerateAccess,
  type GenerateAccessReservation,
} from "@/app/_lib/access-control";
import {
  attachDeviceCookie,
  getIpPrefixHash,
  getOrCreateDeviceIdentity,
} from "@/app/_lib/device-identity";
import {
  createGenerateJob,
  markJobFailed,
  publicJob,
  refundCreditReservation,
  validateGenerateInputFiles,
} from "@/app/_lib/generate-jobs";
import {
  resolveGenerateWorkflowVersioning,
  startGenerateWorkflow,
} from "@/app/_lib/temporal";
import { getVenueById, pickVenue, type ResolvedVenue } from "@/app/_lib/venues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const device = getOrCreateDeviceIdentity(request);
  const ipPrefixHash = getIpPrefixHash(request);
  const user = await getCurrentUser();

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return withDeviceCookie(
      request,
      device,
      NextResponse.json({ error: "Invalid form data" }, { status: 400 }),
    );
  }

  const maleField = formData.get("male");
  const femaleField = formData.get("female");
  const male = maleField instanceof File ? maleField : null;
  const female = femaleField instanceof File ? femaleField : null;
  if (!male && !female) {
    return withDeviceCookie(
      request,
      device,
      NextResponse.json(
        { error: "신부 또는 신랑 사진 중 적어도 한 장이 필요합니다" },
        { status: 400 },
      ),
    );
  }

  try {
    validateGenerateInputFiles({ male, female });
  } catch (error) {
    return withDeviceCookie(
      request,
      device,
      NextResponse.json(
        { error: error instanceof Error ? error.message : "이미지 형식이 올바르지 않습니다" },
        { status: 400 },
      ),
    );
  }

  // Resolve the venue (real-location backdrop) BEFORE reserving credits so a dead/expired
  // venue image never burns a credit reservation. Venue is an enhancement: any failure
  // degrades to a venue-less generation rather than failing the request.
  const venueIdField = formData.get("venueId");
  const venueAutoField = formData.get("venueAuto");
  let venue: ResolvedVenue | null = null;
  try {
    if (typeof venueIdField === "string" && venueIdField) {
      venue = await getVenueById(venueIdField);
    } else if (venueAutoField === "1") {
      venue = await pickVenue();
    }
  } catch {
    venue = null;
  }

  let reservation: Extract<GenerateAccessReservation, { allowed: true }> | null =
    null;
  let record;
  try {
    const workflowVersioning = resolveGenerateWorkflowVersioning();
    const access = await reserveGenerateAccess({
      user,
      deviceHash: device.deviceHash,
      ipPrefixHash,
    });

    if (!access.allowed) {
      return withDeviceCookie(
        request,
        device,
        NextResponse.json(
          {
            code: access.code,
            error: access.message,
            creditsRemaining: access.creditsRemaining,
          },
          { status: access.status },
        ),
      );
    }

    reservation = access;
    record = await createGenerateJob({
      male,
      female,
      venue,
      accessMode: access.accessMode,
      requiresWatermark: access.requiresWatermark,
      userId: access.userId,
      anonymousDeviceHash: device.deviceHash,
      ipPrefixHash,
      quotaWindowId: access.quotaWindowId,
      creditLedgerId: access.creditLedgerId,
      temporalWorkerDeploymentName:
        workflowVersioning.deploymentVersion?.deploymentName,
      temporalWorkerBuildId: workflowVersioning.deploymentVersion?.buildId,
    });
    await startGenerateWorkflow(record.id, workflowVersioning);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "이미지 생성 작업을 시작하지 못했습니다";
    if (record) {
      await markJobFailed(record.id, message).catch(() => undefined);
    } else if (reservation?.creditLedgerId) {
      await refundCreditReservation(
        reservation.creditLedgerId,
        null,
        "job_start_failed",
      ).catch(() => undefined);
    }
    return withDeviceCookie(
      request,
      device,
      NextResponse.json({ error: message }, { status: 502 }),
    );
  }

  return withDeviceCookie(
    request,
    device,
    NextResponse.json(
      publicJob(record, { creditsRemaining: reservation?.creditsRemaining }),
      { status: 202 },
    ),
  );
}

function withDeviceCookie(
  request: NextRequest,
  device: ReturnType<typeof getOrCreateDeviceIdentity>,
  response: NextResponse,
) {
  return attachDeviceCookie(response, request, device);
}
