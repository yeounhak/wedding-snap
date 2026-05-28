import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { readJobRecord } from "@/app/_lib/generate-jobs";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function loadSharedJob(id: string) {
  const record = await readJobRecord(id).catch(() => null);
  if (
    !record ||
    record.status !== "succeeded" ||
    !record.result ||
    !record.sharedAt
  ) {
    return null;
  }
  return record;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const record = await loadSharedJob(id);
  if (!record) {
    return { title: "Wedding Snap" };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const imageUrl = host
    ? `${proto}://${host}/api/generate/${id}/image?variant=watermarked`
    : undefined;

  const title = "AI로 만든 우리 웨딩 사진";
  const description = "Wedding Snap에서 두 사람의 사진으로 웨딩 사진을 만들어 보세요.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: imageUrl ? [{ url: imageUrl, width: 1024, height: 1536 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function SharePage({ params }: Params) {
  const { id } = await params;
  const record = await loadSharedJob(id);

  if (!record) {
    return <NotFound />;
  }

  const imageUrls = Array.from(
    { length: record.result?.count ?? 1 },
    (_, index) => `/api/generate/${id}/image?variant=watermarked&index=${index}`,
  );

  return <SharedView imageUrls={imageUrls} />;
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
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
    </div>
  );
}

function SharedView({ imageUrls }: { imageUrls: string[] }) {
  return (
    <main
      className="min-h-[100dvh] w-full flex flex-col bg-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header className="px-6 py-3">
        <Wordmark />
      </header>

      <div className="flex-1 px-6 py-4 flex flex-col items-center justify-center gap-6">
        <div className="relative w-full max-w-sm aspect-[4/5] rounded-3xl overflow-hidden bg-neutral-100 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)]">
          <div className="absolute inset-0 flex overflow-x-scroll snap-x snap-mandatory no-scrollbar">
            {imageUrls.map((imageUrl, idx) => (
              <div key={imageUrl} className="relative h-full min-w-full snap-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`공유된 웨딩 사진 ${idx + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
          {imageUrls.length > 1 ? (
            <div className="absolute right-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {imageUrls.length}장
            </div>
          ) : null}
        </div>
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            두 사람의 사진으로 만든 웨딩 사진 묶음
          </h1>
          <p className="text-sm text-neutral-500">
            Wedding Snap에서 나도 만들어 보세요
          </p>
        </div>
        <Link
          href="/welcome"
          className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium flex items-center justify-center active:scale-[0.98] transition"
        >
          나도 만들어보기
        </Link>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main
      className="min-h-[100dvh] w-full flex flex-col items-center justify-center gap-5 px-6 text-center bg-white"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 1rem)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl text-neutral-400">
        ?
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-neutral-900">
          공유된 사진을 찾을 수 없어요
        </p>
        <p className="text-sm text-neutral-500">
          링크가 만료되었거나 공유가 해제되었을 수 있어요
        </p>
      </div>
      <Link
        href="/welcome"
        className="w-full max-w-xs h-12 rounded-full bg-neutral-900 text-white font-medium flex items-center justify-center active:scale-[0.98] transition"
      >
        Wedding Snap 만들러 가기
      </Link>
    </main>
  );
}
