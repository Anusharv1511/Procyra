import Link from "next/link";
import { ReactNode } from "react";

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <div className="eyebrow mb-1">{eyebrow}</div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <div className="zone-bands mt-2" aria-hidden><span /><span /><span /></div>
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card p-4 ${className}`}>
      {title && <h2 className="text-sm font-semibold mb-3 text-steel uppercase tracking-wide">{title}</h2>}
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "alarm" }) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "alarm" ? "text-alarm" : "text-ink";
  return (
    <div className="card px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className={`mono text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

const badgeTones: Record<string, string> = {
  ok: "bg-green-50 text-ok border-green-200",
  warn: "bg-amber-50 text-warn border-amber-200",
  alarm: "bg-red-50 text-alarm border-red-200",
  quiet: "bg-gray-50 text-steel border-line",
  accent: "bg-blue-50 text-accent border-blue-200",
};
export function Badge({ tone = "quiet", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeTones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-steel mt-1 max-w-md mx-auto">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="card p-4 opacity-70">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{title}</span>
        <Badge tone="quiet">Coming soon — {phase}</Badge>
      </div>
    </div>
  );
}
