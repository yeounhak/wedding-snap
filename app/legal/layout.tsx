import type { ReactNode } from "react";

import BackButton from "./_components/BackButton";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="h-[100dvh] w-full flex flex-col bg-white"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <header className="px-5 pb-3 flex items-center gap-3 border-b border-neutral-100">
        <BackButton />
        <span className="text-[15px] font-medium text-neutral-500">
          약관 및 정책
        </span>
      </header>
      <article
        className="flex-1 overflow-y-auto no-scrollbar px-6 py-7"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      >
        <div className="mx-auto max-w-xl">{children}</div>
      </article>
    </div>
  );
}
