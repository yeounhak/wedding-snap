import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getSafeNextPath,
  WEDDING_SNAP_HAS_LOGGED_IN_COOKIE,
  WEDDING_SNAP_HAS_LOGGED_IN_MAX_AGE,
} from "@/app/_lib/kakao-auth";
import { createServerSupabaseClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const redirectUrl = getPostLoginRedirectUrl(request, origin);

  if (providerError) {
    return redirectWithError(redirectUrl, providerError);
  }

  if (!code) {
    return redirectWithError(redirectUrl, "missing_auth_code");
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }
    if (!data.user?.email?.trim()) {
      await supabase.auth.signOut().catch(() => undefined);
      return redirectWithError(redirectUrl, "kakao_email_missing");
    }
  } catch (error) {
    console.error(error);
    return redirectWithError(redirectUrl, "kakao_login_failed");
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(WEDDING_SNAP_HAS_LOGGED_IN_COOKIE, "1", {
    httpOnly: true,
    maxAge: WEDDING_SNAP_HAS_LOGGED_IN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

function redirectWithError(url: URL, error: string) {
  url.searchParams.set("auth_error", error);
  return NextResponse.redirect(url);
}

function getPostLoginRedirectUrl(request: NextRequest, origin: string) {
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  return new URL(nextPath ?? "/", origin);
}
