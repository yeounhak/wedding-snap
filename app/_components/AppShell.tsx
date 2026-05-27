"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AuthButton from "./AuthButton";
import LandingSection from "./LandingSection";
import UploadSection from "./UploadSection";
import GenerateSection, { type GenerateJobResponse } from "./GenerateSection";

export default function AppShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLElement>(null);
  const uploadRef = useRef<HTMLElement>(null);
  const generateRef = useRef<HTMLElement>(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [male, setMale] = useState<File | null>(null);
  const [female, setFemale] = useState<File | null>(null);
  const [restoredJob, setRestoredJob] = useState<GenerateJobResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const scrollTo = useCallback((idx: number) => {
    const root = containerRef.current;
    if (!root) return;
    root.scrollTo({ top: idx * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.idx ?? "0",
            );
            setActiveIdx(idx);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    for (const ref of [landingRef, uploadRef, generateRef]) {
      if (ref.current) observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  const reset = useCallback(() => {
    setMale(null);
    setFemale(null);
    setRestoredJob(null);
    scrollTo(0);
  }, [scrollTo]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlockJobId = params.get("unlockJobId");
    const payment = params.get("payment");

    const noticeText =
      payment === "success"
        ? "크레딧이 충전됐어요"
        : payment === "failed"
          ? params.get("reason") ?? "결제가 완료되지 않았어요"
          : null;
    if (noticeText) {
      window.setTimeout(() => setNotice(noticeText), 0);
    }

    if (!unlockJobId) {
      if (payment) cleanUrlParams();
      return;
    }

    let alive = true;
    fetch(`/api/generate/${unlockJobId}/unlock`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error ?? "워터마크를 제거하지 못했습니다");
        }
        return data as GenerateJobResponse;
      })
      .then((job) => {
        if (!alive) return;
        setMale(null);
        setFemale(null);
        setRestoredJob(job);
        setNotice("워터마크를 제거했어요");
        window.setTimeout(() => scrollTo(2), 50);
      })
      .catch((error) => {
        if (!alive) return;
        setNotice(error instanceof Error ? error.message : "워터마크를 제거하지 못했습니다");
      })
      .finally(() => {
        if (alive) cleanUrlParams();
      });

    return () => {
      alive = false;
    };
  }, [scrollTo]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <header
        className="absolute inset-x-0 top-0 z-40 flex items-center gap-2.5 px-6 pb-3 bg-white/85 backdrop-blur-md"
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
        <div className="flex flex-col">
          <span className="text-[17px] font-semibold leading-tight tracking-tight text-neutral-900">
            Wedding Snap
          </span>
          <span className="text-[11px] leading-tight text-neutral-400">
            상상을 현실로
          </span>
        </div>
        <div className="ml-auto">
          <AuthButton />
        </div>
      </header>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll overflow-x-hidden snap-y snap-mandatory no-scrollbar"
      >
        <LandingSection
          ref={landingRef}
          active={activeIdx === 0}
          onStart={() => scrollTo(1)}
        />
        <UploadSection
          ref={uploadRef}
          active={activeIdx === 1}
          male={male}
          female={female}
          onMale={setMale}
          onFemale={setFemale}
          onComplete={() => scrollTo(2)}
        />
        <GenerateSection
          ref={generateRef}
          active={activeIdx === 2}
          male={male}
          female={female}
          restoredJob={restoredJob}
          onRestart={reset}
        />
      </div>

      {notice ? (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function cleanUrlParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("unlockJobId");
  url.searchParams.delete("payment");
  url.searchParams.delete("reason");
  url.searchParams.delete("code");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
