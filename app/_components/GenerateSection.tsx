"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  ref?: React.Ref<HTMLElement>;
  active: boolean;
  male: File | null;
  female: File | null;
  onRestart: () => void;
};

type Status = "idle" | "loading" | "success" | "error";

const PROGRESS_MESSAGES = [
  "사진을 분석하고 있어요…",
  "두 분의 모습을 담는 중이에요…",
  "스타일을 입히는 중이에요…",
  "마지막 손길을 더하는 중이에요…",
];

export default function GenerateSection({
  ref,
  active,
  male,
  female,
  onRestart,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const triggeredRef = useRef(false);

  const generate = useCallback(async () => {
    if (!male || !female) return;
    setStatus("loading");
    setResult(null);
    setError(null);
    setMsgIdx(0);
    try {
      const fd = new FormData();
      fd.append("male", male);
      fd.append("female", female);
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `요청 실패 (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      setResult(data.url);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
      setStatus("error");
    }
  }, [male, female]);

  // Trigger once when this section first becomes active with both files
  useEffect(() => {
    if (!active || !male || !female) return;
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    void generate();
  }, [active, male, female, generate]);

  // Reset trigger when files cleared (so re-uploading regenerates)
  useEffect(() => {
    if (!male || !female) {
      triggeredRef.current = false;
      setStatus("idle");
      setResult(null);
      setError(null);
    }
  }, [male, female]);

  // Cycle progress messages while loading
  useEffect(() => {
    if (status !== "loading") return;
    const id = setInterval(
      () => setMsgIdx((i) => (i + 1) % PROGRESS_MESSAGES.length),
      1100,
    );
    return () => clearInterval(id);
  }, [status]);

  const regenerate = () => {
    triggeredRef.current = true;
    void generate();
  };

  return (
    <section
      ref={ref}
      data-idx="2"
      className="snap-start snap-always h-[100dvh] w-full flex flex-col bg-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="px-6 pt-7 pb-3">
        <p className="text-xs text-neutral-400 tracking-wide uppercase">
          Step 2 of 2
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          {status === "success"
            ? "두 분의 웨딩 사진이에요"
            : status === "error"
              ? "다시 시도해주세요"
              : "사진을 만들고 있어요"}
        </h2>
      </div>

      <div className="flex-1 px-6 flex items-center justify-center min-h-0">
        <div className="relative w-full h-full max-h-[62vh] rounded-3xl overflow-hidden bg-neutral-100 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)]">
          {status === "loading" || status === "idle" ? (
            <>
              <div className="absolute inset-0 shimmer" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-12 h-12 rounded-full border-2 border-neutral-300 border-t-neutral-900 animate-spin" />
                <p className="text-sm text-neutral-600 pulse-soft text-center">
                  {PROGRESS_MESSAGES[msgIdx]}
                </p>
              </div>
            </>
          ) : status === "success" && result ? (
            <Image
              src={result}
              alt="생성된 웨딩 사진"
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl">
                !
              </div>
              <p className="text-sm text-neutral-700">{error}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pt-5 pb-6 flex flex-col items-center gap-2.5">
        {status === "success" && result ? (
          <>
            <a
              href={result}
              download="wedding-snap.jpg"
              className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
              </svg>
              사진 저장하기
            </a>
            <button
              type="button"
              onClick={regenerate}
              className="w-full max-w-xs h-11 rounded-full border border-neutral-200 text-neutral-700 font-medium active:scale-[0.98] transition"
            >
              다시 만들기
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="text-xs text-neutral-400 underline-offset-2 hover:underline"
            >
              처음으로
            </button>
          </>
        ) : status === "error" ? (
          <>
            <button
              type="button"
              onClick={regenerate}
              className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium active:scale-[0.98] transition"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="text-xs text-neutral-400 underline-offset-2 hover:underline"
            >
              처음으로
            </button>
          </>
        ) : (
          <p className="text-xs text-neutral-400">잠시만 기다려주세요</p>
        )}
      </div>
    </section>
  );
}
