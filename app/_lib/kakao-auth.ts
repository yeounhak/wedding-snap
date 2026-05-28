import "server-only";

export const KAKAO_OAUTH_SCOPES =
  "profile_nickname profile_image account_email";

// Long-lived marker so returning visitors land on /gallery instead of the
// marketing landing page. Outlives Supabase session expiry and survives
// sign-out — only cleared on account deletion.
export const WEDDING_SNAP_HAS_LOGGED_IN_COOKIE = "wedding_snap_has_logged_in";
export const WEDDING_SNAP_HAS_LOGGED_IN_MAX_AGE = 60 * 60 * 24 * 365;

export function getSafeNextPath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
