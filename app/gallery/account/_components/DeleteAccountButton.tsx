"use client";

import { useState } from "react";

import { createBrowserSupabaseClient } from "@/app/_lib/supabase/client";

export default function DeleteAccountButton({ credits }: { credits: number }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async () => {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "탈퇴 처리에 실패했어요");
      }
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut().catch(() => undefined);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "탈퇴 처리에 실패했어요");
      setDeleting(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-10 px-4 rounded-full border border-red-200 text-[13px] font-medium text-red-600 active:scale-[0.98] transition"
      >
        회원탈퇴
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-neutral-600">
        정말 탈퇴하시겠어요? 만든 사진과 계정 정보가 모두 삭제되며 되돌릴 수
        없어요.
        {credits > 0 ? ` 보유 크레딧 ${credits}개도 함께 소멸됩니다.` : ""}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="h-10 px-4 rounded-full border border-neutral-200 text-[13px] font-medium text-neutral-600 active:scale-[0.98] transition disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="button"
          onClick={withdraw}
          disabled={deleting}
          className="h-10 px-4 rounded-full bg-red-600 text-[13px] font-semibold text-white active:scale-[0.98] transition disabled:opacity-60"
        >
          {deleting ? "탈퇴 처리 중…" : "탈퇴하기"}
        </button>
      </div>
      {error ? <p className="text-[13px] text-red-500">{error}</p> : null}
    </div>
  );
}
