import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { WEDDING_SNAP_HAS_LOGGED_IN_COOKIE } from "./_lib/kakao-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const hasLoggedIn = cookieStore.has(WEDDING_SNAP_HAS_LOGGED_IN_COOKIE);
  redirect(hasLoggedIn ? "/me" : "/welcome");
}
