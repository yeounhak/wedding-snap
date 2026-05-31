import "server-only";

import { getCurrentUser } from "./access-control";
import { cleanEnv } from "./env-clean";

// Admin access is an email allowlist held in the ADMIN_EMAILS env var
// (comma-separated). There is no DB role concept yet; Phase 2 can graduate to
// one if the list grows. Checked fresh on every request — never cached in a
// cookie — because a session can be revoked between navigations.
function adminEmailAllowlist(): string[] {
  const raw = cleanEnv(process.env.ADMIN_EMAILS);
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailAllowlist().includes(email.trim().toLowerCase());
}

// Returns the current user only if they are an allowlisted admin, else null.
export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) return null;
  return user;
}
