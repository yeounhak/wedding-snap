"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SAMPLES } from "../_lib/samples";
import AuthButton from "./AuthButton";

type Props = {
  ref?: React.Ref<HTMLElement>;
  active: boolean;
  onStart: () => void;
};

export default function LandingSection({ ref, onStart }: Props) {
  const swipeRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const handler = () => {
      const w = el.clientWidth;
      if (w === 0) return;
      const next = Math.round(el.scrollLeft / w);
      setIdx(next);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <section
      ref={ref}
      data-idx="0"
      className="snap-start snap-always h-[100dvh] w-full flex flex-col items-center bg-white"
    >
      <header
        className="w-full px-6 pb-3 flex items-center gap-2.5"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-neutral-900 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3)]">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="7" width="18" height="13" rx="3.5" />
            <path d="M8.6 7 9.7 5h4.6l1.1 2" />
            <path
              d="M12 17.2c-1.6-1-2.6-1.9-2.6-3.1 0-.85.66-1.5 1.5-1.5.5 0 .95.24 1.1.6.15-.36.6-.6 1.1-.6.84 0 1.5.65 1.5 1.5 0 1.2-1 2.1-2.6 3.1Z"
              fill="white"
              stroke="none"
            />
          </svg>
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-neutral-900">
          Wedding Snap
        </span>
        <div className="ml-auto">
          <AuthButton />
        </div>
      </header>

      <div
        ref={swipeRef}
        className="flex-1 w-full flex overflow-x-scroll snap-x snap-mandatory no-scrollbar"
      >
        {SAMPLES.map((s, i) => (
          <div
            key={s.src}
            className="min-w-full h-full snap-center snap-always flex items-center justify-center px-5 py-2"
          >
            <div className="relative w-full h-full rounded-3xl overflow-hidden bg-neutral-100 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)]">
              <Image
                src={s.src}
                alt={s.caption}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-sm text-[11px] font-medium tracking-wide text-white">
                AI 예시
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/55 via-black/15 to-transparent">
                <p className="text-white text-sm font-medium drop-shadow-sm">
                  {s.caption}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="w-full px-6 pt-3 pb-3 flex flex-col items-center gap-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex gap-1.5">
          {SAMPLES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === idx ? "w-6 bg-neutral-900" : "w-1.5 bg-neutral-300"
              }`}
            />
          ))}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-center">
          두 사람의 사진으로
          <br />
          웨딩 사진을 만들어 보세요
        </h1>
        <button
          type="button"
          onClick={onStart}
          aria-label="시작하기 — 탭하거나 아래로 스와이프"
          className="mt-1 w-full max-w-xs flex flex-col items-center active:scale-[0.97] transition-transform"
        >
          <div className="w-full h-12 rounded-full bg-neutral-900 text-white font-medium flex items-center justify-center text-base cta-breathe">
            시작하기
          </div>
          <div className="relative mt-2 h-7 w-6 pointer-events-none">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute inset-x-0 top-0 w-6 h-6 text-neutral-400 chev-drift-1"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute inset-x-0 top-0 w-6 h-6 text-neutral-400 chev-drift-2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </button>
        <nav className="flex items-center gap-2 text-[11px] text-neutral-400">
          <Link href="/legal/terms" className="underline-offset-2 hover:underline">
            이용약관
          </Link>
          <span className="text-neutral-300">·</span>
          <Link
            href="/legal/privacy"
            className="underline-offset-2 hover:underline"
          >
            개인정보처리방침
          </Link>
        </nav>
      </div>
    </section>
  );
}
