import type { ReactNode } from "react";

export function DocTitle({
  title,
  effective,
}: {
  title: string;
  effective: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h1>
      <p className="mt-1.5 text-xs text-neutral-400">시행일 {effective}</p>
    </header>
  );
}

export function DocNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-7 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
      {children}
    </div>
  );
}

export function DocSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-7">
      {title ? (
        <h2 className="mb-2.5 text-[15px] font-semibold text-neutral-900">
          {title}
        </h2>
      ) : null}
      <div className="space-y-2.5 text-[14px] leading-[1.7] text-neutral-600">
        {children}
      </div>
    </section>
  );
}

export function DocList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-neutral-300">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function Term({ children }: { children: ReactNode }) {
  return <b className="font-medium text-neutral-800">{children}</b>;
}
