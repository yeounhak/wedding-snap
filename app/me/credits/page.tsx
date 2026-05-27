import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCreditBalance, getCurrentUser } from "@/app/_lib/access-control";
import {
  getCreditProduct,
  listCreditHistory,
  type CreditHistoryItem,
} from "@/app/_lib/payments";

import ChargeButton from "./_components/ChargeButton";
import PaymentNotice from "./_components/PaymentNotice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "크레딧 · Wedding Snap",
};

const REASON_LABEL: Record<CreditHistoryItem["reason"], string> = {
  purchase: "크레딧 충전",
  generation_reserve: "사진 생성",
  generation_refund: "생성 실패 환불",
  manual: "크레딧 조정",
};

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/me");
  }

  const [credits, history] = await Promise.all([
    getCreditBalance(user.id).catch(() => 0),
    listCreditHistory(user.id).catch(() => [] as CreditHistoryItem[]),
  ]);
  const product = getCreditProduct();

  const sp = await searchParams;
  const payment = typeof sp.payment === "string" ? sp.payment : null;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;

  return (
    <main
      className="h-[100dvh] w-full flex flex-col bg-white"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <header className="px-5 pb-3 flex items-center gap-3">
        <Link
          href="/me"
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
        <h1 className="text-lg font-semibold tracking-tight">크레딧</h1>
      </header>

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <section className="rounded-2xl bg-neutral-900 text-white p-5">
          <p className="text-[13px] text-white/60">보유 크레딧</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            {credits}
            <span className="ml-1 text-lg font-medium text-white/70">개</span>
          </p>
          <p className="mt-2 text-[12px] text-white/50">
            크레딧 1개로 워터마크 없는 사진 1장을 만들 수 있어요
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-neutral-900">
                {product.orderName}
              </p>
              <p className="mt-0.5 text-[13px] text-neutral-500">
                크레딧 {product.creditAmount}개
              </p>
            </div>
            <p className="shrink-0 text-xl font-semibold tracking-tight">
              ₩{product.amount.toLocaleString("ko-KR")}
            </p>
          </div>
          <ChargeButton returnTo="/me/credits" />
          <p className="mt-3 text-center text-[12px] text-neutral-400">
            결제 시{" "}
            <Link href="/legal/refund" className="underline underline-offset-2">
              환불·청약철회 안내
            </Link>
            에 동의하게 됩니다
          </p>
        </section>

        <section className="mt-7">
          <h2 className="px-1 text-[13px] font-medium text-neutral-400">
            이용 내역
          </h2>
          {history.length === 0 ? (
            <p className="mt-3 px-1 text-sm text-neutral-400">
              아직 이용 내역이 없어요
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-neutral-100">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] text-neutral-800">
                      {REASON_LABEL[item.reason]}
                    </p>
                    <p className="text-[12px] text-neutral-400">
                      {formatDate(item.createdAt)}
                      {item.amount != null
                        ? ` · ₩${item.amount.toLocaleString("ko-KR")}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[14px] font-semibold tabular-nums ${
                      item.delta > 0 ? "text-emerald-600" : "text-neutral-500"
                    }`}
                  >
                    {item.delta > 0 ? `+${item.delta}` : item.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <PaymentNotice
        status={
          payment === "success"
            ? "success"
            : payment === "failed"
              ? "failed"
              : null
        }
        reason={reason}
      />
    </main>
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
