import { ReactNode } from "react";

interface SectionCardProps {
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
}

export function SectionCard({ title, eyebrow, children }: SectionCardProps) {
  return (
    <section className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-[0_20px_60px_rgba(17,42,70,0.08)] backdrop-blur sm:rounded-[28px] sm:p-6">
      {eyebrow ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-coral">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-lg text-ink sm:text-xl">{title}</h2>
      <div className="mt-4 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}
