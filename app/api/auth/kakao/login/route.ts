import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getKakaoCallbackUrl,
  getKakaoRestApiKey,
  KAKAO_OAUTH_STATE_COOKIE,
  KAKAO_OIDC_SCOPE,
} from "@/app/_lib/kakao-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const state = randomUUID();
  const callbackUrl = getKakaoCallbackUrl(request.url);
  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", getKakaoRestApiKey());
  kakaoAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("scope", KAKAO_OIDC_SCOPE);
  kakaoAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(kakaoAuthUrl);
  response.cookies.set(KAKAO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}
