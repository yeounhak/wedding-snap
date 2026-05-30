"use client";

import { useEffect, useRef } from "react";

// Swipeable result image carousel with dot indicators. Shared by GenerateSection
// (welcome funnel) and the logged-in /generate studio.
export default function ResultCarousel({
  urls,
  activeIdx,
  onActiveIdx,
}: {
  urls: string[];
  activeIdx: number;
  onActiveIdx: (idx: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
  }, [urls]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== activeIdx) {
      onActiveIdx(next);
    }
  };

  return (
    <>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="absolute inset-0 flex overflow-x-scroll snap-x snap-mandatory no-scrollbar"
      >
        {urls.map((url, idx) => (
          <div key={url} className="relative h-full min-w-full snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`생성된 웨딩 사진 ${idx + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      {urls.length > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {urls.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                idx === activeIdx ? "w-6 bg-white" : "w-1.5 bg-white/55"
              }`}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
