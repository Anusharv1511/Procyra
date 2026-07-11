import Link from "next/link";
import { getSessionUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

const LOOP = [
  ["Log a measurement", "SPC stream, phone or desktop"],
  ["Auto-flagged", "Western Electric rules run on entry"],
  ["Capability recalculates", "Cpk drop raises an alert"],
  ["Defects hit the Pareto", "always sorted, always current"],
  ["Repeat defect → CAPA drafted", "for your review, never silent"],
  ["FMEA stays honest", "RPN auto-resorts the register"],
];

export default async function Landing() {
  if (await getSessionUserId()) redirect("/dashboard");
  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <span className="font-bold tracking-tight">Procyra</span>
          <nav className="flex gap-3">
            <Link className="btn btn-quiet" href="/login">Log in</Link>
            <Link className="btn" href="/register">Create account</Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="eyebrow mb-2">Industrial · Process · Quality engineering</div>
        <h1 className="text-4xl font-bold tracking-tight max-w-2xl">
          The repeatable 80% of the job, automated.
        </h1>
        <p className="mt-4 max-w-xl text-steel">
          Procyra handles the calculations, tracking, monitoring, scheduling, and
          documentation — so you spend your time on judgment calls, not spreadsheets.
          It doesn&apos;t replace engineers. It replaces their busywork.
        </p>
        <div className="mt-8 grid gap-2 sm:grid-cols-2 max-w-3xl">
          {LOOP.map(([h, b], i) => (
            <div key={h} className="card px-4 py-3 flex gap-3 items-baseline">
              <span className="mono text-xs text-steel">{String(i + 1).padStart(2, "0")}</span>
              <span><span className="font-semibold text-sm">{h}</span>{" "}
              <span className="text-sm text-steel">— {b}</span></span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-steel max-w-xl">
          New to this work? <span className="font-semibold text-ink">Guided Mode</span> walks
          you through the full DMAIC loop step by step — the app suggests, your team decides,
          every decision is logged.
        </p>
      </section>
    </main>
  );
}
