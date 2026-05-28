import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Refreshes the Supabase session on every page navigation so Server Components
 * (which cannot write cookies) always read a fresh session. API route handlers
 * are excluded via the matcher because they manage their own auth cookies.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // No Supabase config — nothing to refresh, let the request through untouched.
  if (!supabaseUrl || !supabasePublishableKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: refresh immediately and run nothing between createServerClient
  // and getUser(), so a rotated token is written onto `response` first.
  await supabase.auth.getUser();

  // IMPORTANT: return `response` as-is so refreshed Set-Cookie headers reach the
  // browser. Building a different response here would drop them.
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on page navigations only. Exclude:
     * - api               (route handlers own their auth cookies)
     * - _next/static, _next/image (build assets)
     * - favicon.ico and any image file (e.g. /samples/*.jpg on the landing)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
