"use client";

import { useEffect, useState } from "react";

type Props = {
  status: "success" | "failed" | null;
  reason?: string;
};

export default function PaymentNotice({ status, reason }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!status) return;

    // Drop the one-shot payment params so a refresh doesn't re-show the toast.
    const url = new URL(window.location.href);
    for (const key of ["payment", "reason", "code", "returnTo"]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );

    const timer = window.setTimeout(() => setDismissed(true), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!status || dismissed) return null;

  const text =
    status === "success"
      ? "크레딧이 충전됐어요"
      : (reason ?? "결제가 완료되지 않았어요");

  return (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
      {text}
    </div>
  );
}
