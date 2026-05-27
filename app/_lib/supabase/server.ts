import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabaseDatabaseUrl =
  process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

export function createServerSupabaseClient() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!supabasePublishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  }

  return createClient(supabaseUrl, supabasePublishableKey);
}

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
