"use client";

import { useEffect, useRef, useState } from "react";

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
  active,
  male,
  female,
  onMale,
  onFemale,
  onComplete,
}: Props) {
  const advancedRef = useRef(false);
  const [autoProgress, setAutoProgress] = useState(false);

  useEffect(() => {
    if (!male || !female) {
      advancedRef.current = false;
      setAutoProgress(false);
      return;
    }
    if (advancedRef.current) return;
    advancedRef.current = true;
    setAutoProgress(true);
    const t = setTimeout(() => {
      setAutoProgress(false);
      onComplete();
    }, 800);
    return () => clearTimeout(t);
  }, [male, female, onComplete]);

  const bothReady = !!male && !!female;

  return (
    <section
      ref={ref}
      data-idx="1"
      className="snap-start snap-always h-[100dvh] w-full flex flex-col bg-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="px-6 pt-7 pb-3">
        <p className="text-xs text-neutral-400 tracking-wide uppercase">
          Step 1 of 2
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          두 사람의 사진을 올려주세요
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          얼굴이 잘 보이는 정면 사진이 좋아요
        </p>
      </div>

      <div className="flex-1 px-6 pb-4 flex gap-3 min-h-0">
        <UploadSlot
          label="신랑"
          icon="♂"
          file={male}
          onChange={onMale}
          accent="bg-sky-50 border-sky-200"
          activeAccent="ring-sky-400"
        />
        <UploadSlot
          label="신부"
          icon="♀"
          file={female}
          onChange={onFemale}
          accent="bg-rose-50 border-rose-200"
          activeAccent="ring-rose-400"
        />
      </div>

      <div className="px-6 pb-6 flex flex-col items-center gap-3">
        <p
          className={`text-sm transition-colors ${
            bothReady ? "text-neutral-900 font-medium" : "text-neutral-400"
          }`}
        >
          {autoProgress
            ? "잠시 후 다음 단계로 이동합니다…"
            : bothReady
              ? "준비 완료!"
              : male || female
                ? "나머지 한 장도 올려주세요"
                : "두 장 모두 필요해요"}
        </p>
        <button
          type="button"
          onClick={onComplete}
          disabled={!bothReady}
          className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium disabled:bg-neutral-200 disabled:text-neutral-400 active:scale-[0.98] transition"
        >
          {bothReady ? "사진 만들기" : "사진 두 장 필요"}
        </button>
        {!bothReady && active && (
          <p className="text-[11px] text-neutral-300">
            사진은 외부로 저장되지 않아요
          </p>
        )}
      </div>
    </section>
  );
}

function UploadSlot({
  label,
  icon,
  file,
  onChange,
  accent,
  activeAccent,
}: {
  label: string;
  icon: string;
  file: File | null;
  onChange: (f: File | null) => void;
  accent: string;
  activeAccent: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const id = `upload-${label}`;

  return (
    <label
      htmlFor={id}
      className={`relative flex-1 min-h-0 rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer transition ${
        preview
          ? `border-transparent ring-2 ${activeAccent} bg-neutral-100`
          : `${accent} hover:brightness-95`
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
          {/* using <img> instead of next/image because object URLs can't be optimized */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[11px] font-medium">
            {label}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange(null);
            }}
            aria-label="삭제"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-90 transition"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/50 to-transparent">
            <p className="text-white text-xs">탭해서 다시 선택</p>
          </div>
        </>
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center text-center p-3 gap-3">
          <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-xl">
            {icon}
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-800">{label}</p>
            <p className="mt-1 text-xs text-neutral-500">탭해서 사진 선택</p>
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
        </div>
      )}
    </label>
  );
}
