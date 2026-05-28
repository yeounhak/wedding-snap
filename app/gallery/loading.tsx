export default function Loading() {
  return (
    <main
      className="h-[100dvh] w-full flex flex-col bg-white"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <header className="px-5 pb-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-neutral-100 shimmer" />
        <div className="h-5 w-20 rounded-md bg-neutral-100 shimmer" />
        <div className="ml-auto h-9 w-20 rounded-full bg-neutral-100 shimmer" />
      </header>
      <div className="flex-1 px-5">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] rounded-2xl bg-neutral-100 shimmer"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
