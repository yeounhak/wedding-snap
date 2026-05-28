import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getSafeNextPath,
  KAKAO_OAUTH_SCOPES,
} from "@/app/_lib/kakao-auth";
import { createServerSupabaseClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const callbackUrl = new URL("/api/auth/callback", request.nextUrl.origin);
  if (nextPath) {
    callbackUrl.searchParams.set("next", nextPath);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: KAKAO_OAUTH_SCOPES,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error(error ?? new Error("Supabase did not return OAuth URL"));
    const redirectUrl = new URL(nextPath ?? "/", request.nextUrl.origin);
    redirectUrl.searchParams.set("auth_error", "kakao_login_failed");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(data.url);
}
