export default function Loading() {
  return (
    <main
      className="h-[100dvh] w-full flex flex-col bg-white"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <header className="px-5 pb-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-neutral-100 shimmer" />
        <div className="h-5 w-16 rounded-md bg-neutral-100 shimmer" />
      </header>
      <div className="flex-1 px-5 space-y-4">
        <div className="h-28 rounded-2xl bg-neutral-100 shimmer" />
        <div className="h-24 rounded-2xl bg-neutral-100 shimmer" />
        <div className="h-5 w-20 rounded-md bg-neutral-100 shimmer" />
      </div>
    </main>
  );
}
