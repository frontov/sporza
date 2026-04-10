interface MetricPillProps {
  label: string;
  value: string;
}

export function MetricPill({ label, value }: MetricPillProps) {
  return (
    <div className="rounded-full border border-ink/10 bg-sky px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
