"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { shareResultPhoto } from "@/app/_lib/share-result";

type Props = {
  ref?: React.Ref<HTMLElement>;
  active: boolean;
  male: File | null;
  female: File | null;
  restoredJob: GenerateJobResponse | null;
  onRestart: () => void;
};

type Status = "idle" | "loading" | "success" | "error";

type GenerateJobStatus = "queued" | "running" | "succeeded" | "failed";

export type GenerateJobResponse = {
  jobId: string;
  status: GenerateJobStatus;
  resultUrl?: string;
  error?: string;
  watermarkRequired?: boolean;
  creditsRemaining?: number;
};

type GenerateErrorResponse = {
  code?: "LOGIN_REQUIRED" | "CREDIT_REQUIRED" | "RATE_LIMITED";
  error?: string;
  creditsRemaining?: number;
};

type ErrorAction = "login" | "purchase" | null;

const PROGRESS_MESSAGES = [
  "사진을 분석하고 있어요…",
  "모습을 담는 중이에요…",
  "스타일을 입히는 중이에요…",
  "마지막 손길을 더하는 중이에요…",
];

type SubjectMode = "couple" | "bride" | "groom";

function getSubjectMode(male: File | null, female: File | null): SubjectMode | null {
  if (male && female) return "couple";
  if (female) return "bride";
  if (male) return "groom";
  return null;
}

const SUCCESS_TITLE: Record<SubjectMode, string> = {
  couple: "두 분의 웨딩 사진이에요",
  bride: "신부 웨딩 사진이에요",
  groom: "신랑 웨딩 사진이에요",
};

export default function GenerateSection({
  ref,
  active,
  male,
  female,
  restoredJob,
  onRestart,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [job, setJob] = useState<GenerateJobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ErrorAction>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [paymentWorking, setPaymentWorking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const triggeredRef = useRef(false);
  const generationSeqRef = useRef(0);
  const subjectMode = getSubjectMode(male, female);
  const hasInputs = subjectMode !== null;
  const hasRestoredJob = Boolean(restoredJob?.resultUrl);
  const hasDisplayContext = hasInputs || hasRestoredJob;
  const displayStatus = hasDisplayContext ? status : "idle";
  const displayResult = hasDisplayContext ? result : null;
  const displayError = hasDisplayContext ? error : null;

  const generate = useCallback(async () => {
    if (!male && !female) return;
    const generationSeq = generationSeqRef.current + 1;
    generationSeqRef.current = generationSeq;
    setStatus("loading");
    setResult(null);
    setJob(null);
    setError(null);
    setErrorAction(null);
    setMsgIdx(0);
    try {
      const fd = new FormData();
      if (male) fd.append("male", male);
      if (female) fd.append("female", female);
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as GenerateErrorResponse;
        if (data.code === "LOGIN_REQUIRED" || data.code === "RATE_LIMITED") {
          setErrorAction("login");
        }
        if (data.code === "CREDIT_REQUIRED") {
          setErrorAction("purchase");
        }
        throw new Error(data?.error ?? `요청 실패 (${res.status})`);
      }
      const data = (await res.json()) as GenerateJobResponse;
      const finalJob = await pollJob(
        data.jobId,
        () => generationSeqRef.current === generationSeq,
      );
      if (generationSeqRef.current !== generationSeq) return;
      if (!finalJob.resultUrl) {
        throw new Error("생성된 이미지 URL을 받지 못했습니다");
      }
      setJob(finalJob);
      setResult(finalJob.resultUrl);
      setStatus("success");
    } catch (err) {
      if (generationSeqRef.current !== generationSeq) return;
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
      setStatus("error");
    }
  }, [male, female]);

  useEffect(() => {
    if (!restoredJob?.resultUrl) return;
    const id = window.setTimeout(() => {
      generationSeqRef.current += 1;
      triggeredRef.current = true;
      setJob(restoredJob);
      setResult(restoredJob.resultUrl ?? null);
      setError(null);
      setErrorAction(null);
      setStatus("success");
    }, 0);
    return () => window.clearTimeout(id);
  }, [restoredJob]);

  // Trigger once when this section first becomes active with at least one file
  useEffect(() => {
    if (!active || (!male && !female)) return;
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    void generate();
  }, [active, male, female, generate]);

  // Reset trigger when all files clear so re-uploading starts a new Workflow.
  useEffect(() => {
    if (!male && !female) {
      if (restoredJob?.resultUrl) return;
      generationSeqRef.current += 1;
      triggeredRef.current = false;
    }
  }, [male, female, restoredJob]);

  // Cycle progress messages while loading
  useEffect(() => {
    if (status !== "loading" || !hasInputs) return;
    const id = setInterval(
      () => setMsgIdx((i) => (i + 1) % PROGRESS_MESSAGES.length),
      1100,
    );
    return () => clearInterval(id);
  }, [hasInputs, status]);

  const regenerate = () => {
    triggeredRef.current = true;
    void generate();
  };

  const loginToUnlock = () => {
    if (!job?.jobId) return;
    const next = `/welcome?unlockJobId=${encodeURIComponent(job.jobId)}`;
    window.location.assign(`/api/auth/kakao/login?next=${encodeURIComponent(next)}`);
  };

  const loginAndContinue = () => {
    window.location.assign("/api/auth/kakao/login");
  };

  const purchaseCredits = () => {
    setPaymentWorking(true);
    setError(null);
    window.location.assign("/me/credits");
  };

  const shareResult = async () => {
    if (!job?.jobId) return;
    setSharing(true);
    setShareNotice(null);
    try {
      const outcome = await shareResultPhoto(job.jobId);
      if (outcome?.method === "copy") {
        setShareNotice("공유 링크를 복사했어요");
      }
    } catch (err) {
      setShareNotice(err instanceof Error ? err.message : "공유하지 못했어요");
    } finally {
      setSharing(false);
    }
  };

  return (
    <section
      ref={ref}
      data-idx="2"
      className="snap-start snap-always h-[100dvh] w-full flex flex-col bg-white"
      style={{
        paddingTop: "calc(max(env(safe-area-inset-top), 1rem) + 3rem)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="px-6 pt-4 pb-3">
        <h2 className="text-2xl font-semibold tracking-tight">
          {displayStatus === "success"
            ? SUCCESS_TITLE[subjectMode ?? "couple"]
            : displayStatus === "error"
              ? "다시 시도해주세요"
              : "사진을 만들고 있어요"}
        </h2>
      </div>

      <div className="flex-1 px-6 flex items-center justify-center min-h-0">
        <div className="relative w-full h-full max-h-[62vh] rounded-3xl overflow-hidden bg-neutral-100 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)]">
          {displayStatus === "loading" || displayStatus === "idle" ? (
            <>
              <div className="absolute inset-0 shimmer" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-12 h-12 rounded-full border-2 border-neutral-300 border-t-neutral-900 animate-spin" />
                <p className="text-sm text-neutral-600 pulse-soft text-center">
                  {PROGRESS_MESSAGES[msgIdx]}
                </p>
              </div>
            </>
          ) : displayStatus === "success" && displayResult ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayResult}
              alt="생성된 웨딩 사진"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl">
                !
              </div>
              <p className="text-sm text-neutral-700">{displayError}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pt-5 pb-3 flex flex-col items-center gap-2.5">
        {displayStatus === "success" && displayResult ? (
          <>
            <a
              href={displayResult}
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
              onClick={shareResult}
              disabled={sharing}
              className="w-full max-w-xs h-11 rounded-full border border-neutral-200 text-neutral-700 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
              {sharing ? "공유 준비 중" : "공유하기"}
            </button>
            {shareNotice ? (
              <p className="text-[12px] text-neutral-500">{shareNotice}</p>
            ) : null}
            {job?.watermarkRequired ? (
              <button
                type="button"
                onClick={loginToUnlock}
                className="w-full max-w-xs h-11 rounded-full bg-[#FEE500] text-[#191919] font-semibold active:scale-[0.98] transition"
              >
                카카오 로그인하고 워터마크 제거
              </button>
            ) : null}
            {hasInputs ? (
              <button
                type="button"
                onClick={regenerate}
                className="w-full max-w-xs h-11 rounded-full border border-neutral-200 text-neutral-700 font-medium active:scale-[0.98] transition"
              >
                다시 만들기
              </button>
            ) : null}
            <button
              type="button"
              onClick={onRestart}
              className="text-xs text-neutral-400 underline-offset-2 hover:underline"
            >
              처음으로
            </button>
          </>
        ) : displayStatus === "error" ? (
          <>
            {errorAction === "login" ? (
              <button
                type="button"
                onClick={loginAndContinue}
                className="w-full max-w-xs h-12 rounded-full bg-[#FEE500] text-[#191919] font-semibold active:scale-[0.98] transition"
              >
                카카오 로그인
              </button>
            ) : errorAction === "purchase" ? (
              <button
                type="button"
                onClick={purchaseCredits}
                disabled={paymentWorking}
                className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium active:scale-[0.98] transition disabled:opacity-60"
              >
                {paymentWorking ? "결제 준비 중" : "크레딧 구매하기"}
              </button>
            ) : (
              <button
                type="button"
                onClick={regenerate}
                className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium active:scale-[0.98] transition"
              >
                다시 시도
              </button>
            )}
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

      <nav className="px-6 pb-5 flex items-center justify-center gap-2 text-[11px] text-neutral-400">
        <Link href="/legal/terms" className="underline-offset-2 hover:underline">
          이용약관
        </Link>
        <span className="text-neutral-300">·</span>
        <Link href="/legal/privacy" className="underline-offset-2 hover:underline">
          개인정보처리방침
        </Link>
      </nav>
    </section>
  );
}

async function pollJob(jobId: string, isCurrent: () => boolean) {
  while (isCurrent()) {
    await wait(2500);
    if (!isCurrent()) break;

    const res = await fetch(`/api/generate/${jobId}`, { cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `상태 확인 실패 (${res.status})`);
    }

    const data = (await res.json()) as GenerateJobResponse;
    if (data.status === "succeeded") {
      return data;
    }
    if (data.status === "failed") {
      throw new Error(data.error ?? "이미지 생성에 실패했습니다");
    }
  }

  throw new Error("요청이 취소되었습니다");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
