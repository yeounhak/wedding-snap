"use client";

import Link from "next/link";
import { useState } from "react";

import type { GalleryItem } from "@/app/_lib/gallery";
import { shareResultPhoto } from "@/app/_lib/share-result";
import { createBrowserSupabaseClient } from "@/app/_lib/supabase/client";

type Props = {
  items: GalleryItem[];
  credits: number;
  userLabel: string;
};

export default function GalleryClient({ items, credits, userLabel }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const active = activeIdx === null ? null : items[activeIdx] ?? null;

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut().catch(() => undefined);
    window.location.assign("/");
  };

  return (
    <main
      className="h-[100dvh] w-full flex flex-col bg-white"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <header className="px-5 pb-3 flex items-center gap-3">
        <Link
          href="/"
          aria-label="홈으로"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 active:scale-95 transition"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">내 사진</h1>
        <Link
          href="/me/credits"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 h-9 text-[13px] font-medium text-neutral-700 active:scale-[0.98] transition"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5v9M9.5 10h3.2a1.8 1.8 0 0 1 0 3.6H9.5" strokeLinecap="round" />
          </svg>
          크레딧 {credits}
        </Link>
      </header>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-1 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => (
              <button
                key={item.jobId}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-100 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.2)] active:scale-[0.98] transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.resultUrl}
                  alt="내가 만든 웨딩 사진"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/35 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white">
                  {formatDate(item.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AccountFooter
        userLabel={userLabel}
        signingOut={signingOut}
        onSignOut={signOut}
      />

      {active ? (
        <Viewer item={active} onClose={() => setActiveIdx(null)} />
      ) : null}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 px-6 flex flex-col items-center justify-center text-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="7" width="18" height="13" rx="3.5" />
          <path d="M8.6 7 9.7 5h4.6l1.1 2" />
          <circle cx="12" cy="13.5" r="3.2" />
        </svg>
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-neutral-900">
          아직 만든 사진이 없어요
        </p>
        <p className="text-sm text-neutral-500">
          두 사람의 사진으로 웨딩 사진을 만들어 보세요
        </p>
      </div>
      <Link
        href="/"
        className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium flex items-center justify-center active:scale-[0.98] transition"
      >
        사진 만들러 가기
      </Link>
    </div>
  );
}

function AccountFooter({
  userLabel,
  signingOut,
  onSignOut,
}: {
  userLabel: string;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <div
      className="shrink-0 px-5 pt-4 border-t border-neutral-100"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-neutral-500">
          {userLabel}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="shrink-0 rounded-full border border-neutral-200 px-3.5 h-9 text-[13px] font-medium text-neutral-600 active:scale-[0.98] transition disabled:opacity-60"
        >
          {signingOut ? "로그아웃 중" : "로그아웃"}
        </button>
      </div>
      <nav className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
        <Link href="/legal/terms" className="underline-offset-2 hover:underline">
          이용약관
        </Link>
        <span className="text-neutral-300">·</span>
        <Link href="/legal/privacy" className="underline-offset-2 hover:underline">
          개인정보처리방침
        </Link>
        <span className="text-neutral-300">·</span>
        <Link href="/legal/refund" className="underline-offset-2 hover:underline">
          환불·사업자정보
        </Link>
      </nav>
    </div>
  );
}

function Viewer({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const share = async () => {
    setSharing(true);
    setShareNotice(null);
    try {
      const outcome = await shareResultPhoto(item.jobId);
      if (outcome?.method === "copy") {
        setShareNotice("공유 링크를 복사했어요");
      }
    } catch (err) {
      setShareNotice(err instanceof Error ? err.message : "공유하지 못했어요");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
      }}
    >
      <div className="px-4 flex items-center justify-between">
        <span className="text-[13px] text-white/60">
          {formatDate(item.createdAt)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white active:scale-95 transition"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.resultUrl}
          alt="내가 만든 웨딩 사진"
          className="max-h-full max-w-full object-contain rounded-xl"
        />
      </div>

      <div className="px-6 flex flex-col items-center gap-2.5">
        <a
          href={item.resultUrl}
          download={`wedding-snap-${item.jobId}.jpg`}
          className="w-full max-w-xs h-12 rounded-full bg-white text-neutral-900 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
          </svg>
          사진 저장하기
        </a>
        <button
          type="button"
          onClick={share}
          disabled={sharing}
          className="w-full max-w-xs h-11 rounded-full border border-white/25 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          {sharing ? "공유 준비 중" : "공유하기"}
        </button>
        {shareNotice ? (
          <p className="text-[12px] text-white/60">{shareNotice}</p>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}
