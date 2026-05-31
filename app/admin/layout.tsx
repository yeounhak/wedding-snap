import type { Metadata, Viewport } from "next";

// The customer app is mobile-first: the ROOT layout (app/layout.tsx) locks the
// viewport (maximumScale=1, userScalable=false) and sets `body` to
// `overflow-hidden`. Admin is a DESKTOP tool, so this nested layout overrides
// the viewport (Next merges metadata/viewport root->leaf, deeper wins) to allow
// zoom, and provides its own `h-screen overflow-y-auto` scroll container —
// because `body` stays `overflow-hidden`, a `min-h-screen` div would be clipped
// instead of scrolling, so the container must be a fixed-height scroller.
export const metadata: Metadata = {
  title: "Admin · Wedding Snap",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0a0a0a",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="h-screen w-full overflow-y-auto bg-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold tracking-tight">Wedding Snap</span>
            <span className="rounded bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
              ADMIN
            </span>
          </div>
          <nav className="flex items-center gap-5 text-sm text-neutral-500">
            <a className="transition-colors hover:text-neutral-900" href="/admin/prompts">
              프롬프트
            </a>
            <a className="transition-colors hover:text-neutral-900" href="/gallery">
              앱으로 ↗
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-6 py-8">{children}</main>
    </div>
  );
}
