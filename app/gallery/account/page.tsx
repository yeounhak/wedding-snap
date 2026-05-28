import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCreditBalance, getCurrentUser } from "@/app/_lib/access-control";

import DeleteAccountButton from "./_components/DeleteAccountButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 설정 · Wedding Snap",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/gallery");
  }

  const credits = await getCreditBalance(user.id).catch(() => 0);
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nickname =
    pickString(metadata.full_name) ??
    pickString(metadata.name) ??
    pickString(metadata.nickname) ??
    pickString(metadata.preferred_username) ??
    user.email ??
    "회원";
  const joinedAt = user.created_at ? formatDate(user.created_at) : "—";

  return (
    <main
      className="h-[100dvh] w-full flex flex-col bg-white"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <header className="px-5 pb-3 flex items-center gap-3">
        <Link
          href="/gallery"
          aria-label="뒤로"
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
        <h1 className="text-lg font-semibold tracking-tight">계정 설정</h1>
      </header>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <section className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
          <InfoRow label="로그인" value="카카오" />
          <InfoRow label="닉네임" value={nickname} />
          <InfoRow label="가입일" value={joinedAt} />
          <Link
            href="/gallery/credits"
            className="flex items-center justify-between gap-3 px-4 py-3.5 active:bg-neutral-50 transition"
          >
            <span className="text-[13px] text-neutral-500">보유 크레딧</span>
            <span className="flex items-center gap-1 text-[14px] font-medium text-neutral-800">
              {credits}개
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-neutral-300"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="px-1 text-[13px] font-medium text-neutral-400">
            회원탈퇴
          </h2>
          <div className="mt-2 rounded-2xl border border-neutral-200 p-4 space-y-3">
            <p className="text-[13px] leading-relaxed text-neutral-500">
              탈퇴하면 만든 사진과 업로드한 원본, 계정 정보가 모두 영구
              삭제되며 복구할 수 없어요.
            </p>
            <DeleteAccountButton credits={credits} />
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-[13px] text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-[14px] font-medium text-neutral-800">
        {value}
      </span>
    </div>
  );
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}
