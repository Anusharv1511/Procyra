import { Card, PageHeader, Stat, EmptyState } from "@/components/ui";
import Histogram from "@/components/charts/Histogram";
import AlertsBanner from "@/components/AlertsBanner";
import { GLOSSARY } from "@/lib/glossary";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { xbarRLimits, imrLimits, capability, mean, range } from "@/lib/spc";

export const dynamic = "force-dynamic";

export default async function Capability({ params, searchParams }: {
  params: { projectId: string }; searchParams: { stream?: string };
}) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const streams = (await db.select().from(t.streams).where(eq(t.streams.projectId, project.id)))
    .filter(s => s.type.startsWith("SPC"));

  const selected = streams.find(s => s.id === searchParams.stream) ?? streams[0];
  let content: React.ReactNode = null;

  if (!streams.length) {
    content = <EmptyState title="No SPC streams yet"
      body="Capability is computed straight from your SPC data — no re-entry. Create a control chart stream with spec limits first."
      cta={<Link className="btn" href={`/p/${project.id}/spc`}>Go to control charts</Link>} />;
  } else if (selected) {
    const pts = await db.select().from(t.dataPoints)
      .where(eq(t.dataPoints.streamId, selected.id)).orderBy(asc(t.dataPoints.ts));
    const valuesPer = pts.map(p => ((p.payload as any).values as number[]) ?? []);
    const all = valuesPer.flat();
    const hasSpecs = selected.specLow != null || selected.specHigh != null;

    if (!hasSpecs) {
      content = <EmptyState title="This stream has no spec limits"
        body="Cp/Cpk compare process spread to specification limits. Add LSL/USL when creating the stream (edit support arrives with Phase 2)." />;
    } else if (all.length < 10) {
      content = <EmptyState title={`Only ${all.length} measurement${all.length === 1 ? "" : "s"} logged`}
        body="Capability needs at least 10 measurements to say anything defensible (30+ recommended). Keep logging on the control chart." />;
    } else {
      const isXbar = selected.type === "SPC_XBAR_R";
      const lim = isXbar
        ? xbarRLimits(valuesPer.map(mean), valuesPer.map(range), selected.subgroupSize)
        : imrLimits(valuesPer.map(v => v[0]));
      const cap = capability(all, lim.sigmaWithin, selected.specLow, selected.specHigh);

      // histogram bins
      const lo = Math.min(...all, selected.specLow ?? Infinity);
      const hi = Math.max(...all, selected.specHigh ?? -Infinity);
      const nb = Math.min(18, Math.max(7, Math.ceil(Math.sqrt(all.length))));
      const w = (hi - lo) / nb || 1;
      const bins = Array.from({ length: nb }, (_, i) => {
        const x0 = lo + i * w;
        return { x0, bin: (x0 + w / 2).toFixed(2), count: 0 };
      });
      for (const v of all) {
        const i = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / w)));
        bins[i].count++;
      }
      const nearest = (v: number | null) => v == null ? null
        : bins.reduce((best, b) => Math.abs(b.x0 + w / 2 - v) < Math.abs(best.x0 + w / 2 - v) ? b : best, bins[0]).bin;

      const fmt = (x: number | null) => (x == null ? "—" : x.toFixed(2));
      const tone = (x: number | null) => x == null ? undefined : x >= selected.cpkThreshold ? "ok" as const : x >= 1 ? "warn" as const : "alarm" as const;

      content = (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Cp (within)" value={fmt(cap.cp)} tone={tone(cap.cp)} help={GLOSSARY.cp} />
            <Stat label="Cpk (within)" value={fmt(cap.cpk)} tone={tone(cap.cpk)} help={GLOSSARY.cpk} />
            <Stat label="Pp (overall)" value={fmt(cap.pp)} tone={tone(cap.pp)} help={GLOSSARY.pp} />
            <Stat label="Ppk (overall)" value={fmt(cap.ppk)} tone={tone(cap.ppk)} help={GLOSSARY.ppk} />
          </div>
          <Card title="Distribution vs. specification">
            <Histogram bins={bins.map(({ bin, count }) => ({ bin, count }))}
              lslBin={nearest(selected.specLow)} uslBin={nearest(selected.specHigh)} />
            <p className="text-xs text-steel mt-2">
              n = {cap.n} · mean {cap.mean.toFixed(3)} · σ within {cap.sigmaWithin.toFixed(4)} (R̄/d₂ method) · σ overall {cap.sigmaOverall.toFixed(4)} (sample s).
              Cpk below {selected.cpkThreshold} raises an alert automatically when new data arrives — this alert tracks Cpk (short-term/within) only; Ppk (overall) is shown for reference but does not trigger an alert.
              Indices assume approximate normality — check the histogram shape before quoting them.
            </p>
          </Card>
        </>
      );
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Measure & analyze" title="Process capability" />
      <AlertsBanner projectId={project.id} sourceTypes={["CAPABILITY"]} scopeLabel="this project's capability checks" inboxCategory="CAPABILITY" />
      {streams.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {streams.map(s => (
            <Link key={s.id} href={`/p/${project.id}/capability?stream=${s.id}`}
              className={`btn ${selected?.id === s.id ? "" : "btn-quiet"}`}>{s.name}</Link>
          ))}
        </div>
      )}
      {content}
    </div>
  );
}
