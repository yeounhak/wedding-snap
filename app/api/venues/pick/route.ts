import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/_lib/access-control";
import { pickVenuePreview } from "@/app/_lib/venues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns one auto-assigned 4-star venue (metadata + display image URL) for the /generate
// studio. `?exclude=12,34` skips already-seen venues so "다른 장소" shuffles to a new one.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const excludeParam = request.nextUrl.searchParams.get("exclude") ?? "";
  const excludeIds = excludeParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const venue = await pickVenuePreview({ excludeIds });
    return NextResponse.json({ venue });
  } catch {
    // Venue is an enhancement; never hard-fail the studio.
    return NextResponse.json({ venue: null });
  }
}
