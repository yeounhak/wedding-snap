import { createClient } from "@supabase/supabase-js";

import { cleanEnv } from "../env-clean";

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseSecretKey = cleanEnv(process.env.SUPABASE_SECRET_KEY);
const supabaseDatabaseUrl = cleanEnv(
  process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL,
);

export function createSupabaseAdminClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseDatabaseUrl() {
  if (!supabaseDatabaseUrl) {
    throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL is not set");
  }

  return supabaseDatabaseUrl;
}
