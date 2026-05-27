import Link from "next/link";

export default function GalleryLoggedOut() {
  return (
    <main
      className="h-[100dvh] w-full flex flex-col bg-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header className="px-6 pb-3 flex items-center gap-3">
        <Link
          href="/"
          aria-label="홈으로"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 active:scale-95 transition"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">내 사진</h1>
      </header>

      <div className="flex-1 px-6 flex flex-col items-center justify-center text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="7" width="18" height="13" rx="3.5" />
            <path d="M8.6 7 9.7 5h4.6l1.1 2" />
            <circle cx="12" cy="13.5" r="3.2" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-neutral-900">
            로그인하면 만든 사진을 모아볼 수 있어요
          </p>
          <p className="text-sm text-neutral-500">
            카카오 로그인으로 워터마크 없는 사진을
            <br />
            언제든 다시 저장하세요
          </p>
        </div>
        <a
          href="/api/auth/kakao/login?next=%2Fme"
          className="w-full max-w-xs h-12 rounded-full bg-[#FEE500] text-[#191919] font-semibold flex items-center justify-center active:scale-[0.98] transition"
        >
          카카오 로그인
        </a>
        <Link
          href="/"
          className="text-xs text-neutral-400 underline-offset-2 hover:underline"
        >
          사진 만들러 가기
        </Link>
      </div>
    </main>
  );
}
