"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LandingSection from "./LandingSection";
import UploadSection from "./UploadSection";
import GenerateSection from "./GenerateSection";

export default function AppShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLElement>(null);
  const uploadRef = useRef<HTMLElement>(null);
  const generateRef = useRef<HTMLElement>(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [male, setMale] = useState<File | null>(null);
  const [female, setFemale] = useState<File | null>(null);

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
    scrollTo(0);
  }, [scrollTo]);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full overflow-y-scroll overflow-x-hidden snap-y snap-mandatory no-scrollbar"
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
        onRestart={reset}
      />
    </div>
  );
}
