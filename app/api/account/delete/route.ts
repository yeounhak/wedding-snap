import { NextResponse } from "next/server";

import { deleteAccount } from "@/app/_lib/account";
import { getCurrentUser } from "@/app/_lib/access-control";
import { WEDDING_SNAP_HAS_LOGGED_IN_COOKIE } from "@/app/_lib/kakao-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  try {
    await deleteAccount(user.id);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "탈퇴 처리에 실패했어요",
      },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(WEDDING_SNAP_HAS_LOGGED_IN_COOKIE);
  return response;
}
