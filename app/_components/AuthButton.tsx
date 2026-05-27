"use client";

import type { Session } from "@supabase/supabase-js";
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

  const signOut = async () => {
    setWorking(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(error);
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="h-9 w-[88px] rounded-full bg-neutral-100 shimmer" />
    );
  }

  if (session) {
    return (
      <button
        type="button"
        onClick={signOut}
        disabled={working}
        className="min-w-0 max-w-[132px] h-9 px-3 rounded-full border border-neutral-200 bg-white/85 text-[12px] font-medium text-neutral-700 shadow-sm backdrop-blur-sm active:scale-[0.98] disabled:opacity-60"
        title="로그아웃"
      >
        <span className="block truncate">{getUserLabel(session)}</span>
      </button>
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
