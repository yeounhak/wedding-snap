import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  exchangeKakaoCodeForToken,
  getKakaoCallbackUrl,
  getKakaoProviderId,
  getSyntheticKakaoEmail,
  KAKAO_OAUTH_STATE_COOKIE,
  KAKAO_POST_LOGIN_REDIRECT_COOKIE,
} from "@/app/_lib/kakao-auth";
import {
  createServerSupabaseClient,
  createSupabaseAdminClient,
} from "@/app/_lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(KAKAO_OAUTH_STATE_COOKIE)?.value;
  const redirectUrl = getPostLoginRedirectUrl(request, origin);

  if (!code) {
    return redirectWithError(redirectUrl, "missing_kakao_code");
  }

  if (!state || !expectedState || state !== expectedState) {
    return redirectWithError(redirectUrl, "invalid_kakao_state");
  }

  try {
    const { accessToken, idToken } = await exchangeKakaoCodeForToken({
      code,
      redirectUri: getKakaoCallbackUrl(request.url),
    });
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "kakao",
      token: idToken,
      access_token: accessToken,
    });

    if (error) {
      throw error;
    }
    if (data.user) {
      await ensureSyntheticKakaoEmail(data.user);
    }
  } catch (error) {
    console.error(error);
    return redirectWithError(redirectUrl, "kakao_login_failed");
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(KAKAO_OAUTH_STATE_COOKIE);
  response.cookies.delete(KAKAO_POST_LOGIN_REDIRECT_COOKIE);
  return response;
}

function redirectWithError(url: URL, error: string) {
  url.searchParams.set("auth_error", error);
  const response = NextResponse.redirect(url);
  response.cookies.delete(KAKAO_OAUTH_STATE_COOKIE);
  response.cookies.delete(KAKAO_POST_LOGIN_REDIRECT_COOKIE);
  return response;
}

function getPostLoginRedirectUrl(request: NextRequest, origin: string) {
  const nextPath = request.cookies.get(KAKAO_POST_LOGIN_REDIRECT_COOKIE)?.value;
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return new URL("/", origin);
  }

  return new URL(nextPath, origin);
}

async function ensureSyntheticKakaoEmail(user: User) {
  if (user.email?.trim()) return;

  const providerId = getKakaoProviderId(user);
  if (!providerId) {
    throw new Error(`Kakao provider id is missing for user ${user.id}`);
  }

  const syntheticEmail = getSyntheticKakaoEmail(providerId);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      ...user.user_metadata,
      email_is_synthetic: true,
      synthetic_email: syntheticEmail,
    },
  });

  if (error) {
    throw error;
  }
}
