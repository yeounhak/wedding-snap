"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  ref?: React.Ref<HTMLElement>;
  active: boolean;
  male: File | null;
  female: File | null;
  onMale: (f: File | null) => void;
  onFemale: (f: File | null) => void;
  onComplete: () => void;
};

export default function UploadSection({
  ref,
  male,
  female,
  onMale,
  onFemale,
  onComplete,
}: Props) {
  const advancedRef = useRef(false);

  useEffect(() => {
    if (!male || !female) {
      advancedRef.current = false;
      return;
    }
    if (advancedRef.current) return;
    advancedRef.current = true;
    const t = setTimeout(onComplete, 550);
    return () => clearTimeout(t);
  }, [male, female, onComplete]);

  return (
    <section
      ref={ref}
      data-idx="1"
      className="snap-start snap-always h-[100dvh] w-full flex flex-col bg-white"
      style={{
        paddingTop: "calc(max(env(safe-area-inset-top), 1rem) + 3rem)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="px-6 pt-4 pb-3">
        <h2 className="text-[26px] font-semibold tracking-tight leading-snug">
          두 분의 사진을
          <br />
          올려주세요
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          얼굴이 잘 보이는 정면 사진이 좋아요
        </p>
      </div>

      <div className="flex-1 px-6 flex flex-col items-center justify-center gap-3 min-h-0 py-2">
        <UploadSlot
          label="신부"
          file={female}
          onChange={onFemale}
          tone="bride"
        />
        <UploadSlot
          label="신랑"
          file={male}
          onChange={onMale}
          tone="groom"
        />
      </div>

      <div className="px-6 pb-6 text-center">
        <p className="text-xs text-neutral-400 leading-relaxed">
          두 장 모두 올리면
          <br />
          자동으로 샘플 웨딩 스냅이 만들어져요
        </p>
      </div>
    </section>
  );
}

function UploadSlot({
  label,
  file,
  onChange,
  tone,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  tone: "bride" | "groom";
}) {
  const preview = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const id = `upload-${label}`;
  const toneBg =
    tone === "bride"
      ? "bg-gradient-to-br from-rose-50 via-white to-orange-50/40"
      : "bg-gradient-to-br from-slate-50 via-white to-sky-50/40";

  return (
    <label
      htmlFor={id}
      className={`relative min-h-0 w-full max-w-[220px] aspect-[4/5] rounded-[28px] overflow-hidden cursor-pointer transition-all duration-300 ${
        preview
          ? "ring-1 ring-neutral-900/10 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]"
          : `${toneBg} ring-1 ring-neutral-200/70 active:scale-[0.99]`
      }`}
    >
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
          e.target.value = "";
        }}
      />
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[11px] font-medium text-neutral-900 shadow-sm">
            {label}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange(null);
            }}
            aria-label={`${label} 사진 삭제`}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/55 backdrop-blur text-white flex items-center justify-center active:scale-90 transition"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </>
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center text-center p-4 gap-5">
          <div className="w-[60px] h-[60px] rounded-full bg-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.08)] ring-1 ring-neutral-100 flex items-center justify-center text-neutral-400">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="6" width="18" height="14" rx="2.5" />
              <circle cx="12" cy="13" r="4" />
              <path d="M8 6V4h8v2" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">{label}</p>
            <p className="mt-0.5 text-[11px] text-neutral-400">탭해서 추가</p>
          </div>
        </div>
      )}
    </label>
  );
}
