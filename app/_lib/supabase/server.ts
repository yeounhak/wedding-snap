import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { cleanEnv } from "../env-clean";

export {
  createSupabaseAdminClient,
  getSupabaseDatabaseUrl,
} from "./admin";

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabasePublishableKey = cleanEnv(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export async function createServerSupabaseClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!supabasePublishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` runs during a Server Component render (e.g. the /gallery page),
          // where the cookie store is read-only and `.set` throws. Safe to
          // ignore: `proxy.ts` refreshes and persists the session for the
          // request before the component renders, so this is just a safety net.
        }
      },
    },
  });
}
