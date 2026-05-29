import { createBrowserClient } from "@supabase/ssr";

import { cleanEnv } from "../env-clean";

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabasePublishableKey = cleanEnv(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function createBrowserSupabaseClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!supabasePublishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
