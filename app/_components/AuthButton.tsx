"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "../_lib/supabase/client";

export default function AuthButton() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      setWorking(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = async () => {
    setWorking(true);
    window.location.assign("/api/auth/kakao/login");
  };

  if (loading) {
    return (
      <div className="h-9 w-[88px] rounded-full bg-neutral-100 shimmer" />
    );
  }

  if (session) {
    return (
      <Link
        href="/me"
        aria-label="내 사진 보기"
        title="내 사진"
        className="inline-flex h-9 max-w-[160px] items-center gap-1.5 rounded-full border border-neutral-200 bg-white/85 pl-2.5 pr-3 text-neutral-700 shadow-sm backdrop-blur-sm active:scale-[0.98]"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.6" />
          <rect x="14" y="3" width="7" height="7" rx="1.6" />
          <rect x="3" y="14" width="7" height="7" rx="1.6" />
          <rect x="14" y="14" width="7" height="7" rx="1.6" />
        </svg>
        <span className="block truncate text-[12px] font-medium">
          {getUserLabel(session)}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={working}
      className="h-9 shrink-0 rounded-full bg-[#FEE500] px-3.5 text-[12px] font-semibold text-[#191919] shadow-sm active:scale-[0.98] disabled:opacity-60"
    >
      {working ? "연결 중" : "카카오 로그인"}
    </button>
  );
}

function getUserLabel(session: Session) {
  const metadata = session.user.user_metadata;
  const label =
    metadata.full_name ??
    metadata.name ??
    metadata.nickname ??
    metadata.preferred_username ??
    session.user.email ??
    session.user.id.slice(0, 8);

  return `${label}`;
}
