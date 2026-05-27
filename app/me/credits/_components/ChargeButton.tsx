"use client";

import { useState } from "react";

import { startCreditPurchase } from "@/app/_lib/toss-payments";

export default function ChargeButton({ returnTo }: { returnTo: string }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setWorking(true);
    setError(null);
    try {
      // Navigates to the Toss payment window on success (does not resolve here).
      await startCreditPurchase({ returnTo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제를 시작하지 못했어요");
      setWorking(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={working}
        className="w-full h-12 rounded-full bg-neutral-900 text-white font-medium flex items-center justify-center active:scale-[0.98] transition disabled:opacity-60"
      >
        {working ? "결제 준비 중" : "충전하기"}
      </button>
      {error ? (
        <p className="mt-2 text-center text-[13px] text-red-500">{error}</p>
      ) : null}
    </div>
  );
}
