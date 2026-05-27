import "server-only";

import type { User } from "@supabase/supabase-js";

export const KAKAO_OAUTH_STATE_COOKIE = "wedding_snap_kakao_oauth_state";
export const KAKAO_OIDC_SCOPE = "openid profile_nickname profile_image";
export const SYNTHETIC_KAKAO_EMAIL_DOMAIN = "users.wedding-snap.invalid";

type KakaoTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export function getKakaoRestApiKey() {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    throw new Error("KAKAO_REST_API_KEY is not set");
  }
  return key;
}

export function getKakaoClientSecret() {
  const secret = process.env.KAKAO_CLIENT_SECRET;
  if (!secret) {
    throw new Error("KAKAO_CLIENT_SECRET is not set");
  }
  return secret;
}

export function getKakaoCallbackUrl(requestUrl: string) {
  return new URL("/api/auth/kakao/oidc", requestUrl).toString();
}

export function getKakaoProviderId(user: User) {
  const metadata = user.user_metadata;
  const rawProviderId = metadata.provider_id ?? metadata.sub;
  if (typeof rawProviderId === "string" && rawProviderId.trim()) {
    return rawProviderId.trim();
  }
  if (typeof rawProviderId === "number") {
    return `${rawProviderId}`;
  }

  const kakaoIdentity = user.identities?.find(
    (identity) => identity.provider === "kakao",
  );
  return kakaoIdentity?.id?.trim() || null;
}

export function getSyntheticKakaoEmail(providerId: string) {
  const normalized = providerId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalized) {
    throw new Error("Kakao provider id is empty");
  }

  return `kakao-${normalized}@${SYNTHETIC_KAKAO_EMAIL_DOMAIN}`;
}

export async function exchangeKakaoCodeForToken(params: {
  code: string;
  redirectUri: string;
}) {
  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getKakaoRestApiKey(),
      redirect_uri: params.redirectUri,
      code: params.code,
      client_secret: getKakaoClientSecret(),
    }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | KakaoTokenResponse
    | null;

  if (!response.ok) {
    throw new Error(
      data?.error_description ??
        data?.error ??
        `Kakao token request failed (${response.status})`,
    );
  }

  if (!data?.id_token) {
    throw new Error(
      "Kakao did not return id_token. Enable OpenID Connect and request the openid scope.",
    );
  }

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
  };
}
