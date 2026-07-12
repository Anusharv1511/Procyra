import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import { getProject } from "@/lib/data";
import { smedAnalysis, ChangeoverStep } from "@/lib/smed";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SmedDetail({ params }: { params: { projectId: string; coId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [co] = await db.select().from(t.changeovers).where(eq(t.changeovers.id, params.coId));
  if (!co || co.projectId !== project.id) notFound();
  const steps = co.steps as ChangeoverStep[];
  const r = smedAnalysis(steps);

  return (
    <div>
      <PageHeader eyebrow="Monitor & track · SMED" title={`${co.line} — ${new Date(co.date).toLocaleDateString()}`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Total changeover" value={`${r.total.toFixed(1)} min`} />
        <Stat label="Internal (stopped)" value={`${r.internal.toFixed(1)} min`} tone={r.internalPct > 70 ? "warn" : undefined} />
        <Stat label="External" value={`${r.external.toFixed(1)} min`} />
        <Stat label="Internal share" value={`${r.internalPct.toFixed(0)}%`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Steps">
            <table className="data">
              <thead><tr><th>#</th><th>Step</th><th>Duration (min)</th><th>Type</th></tr></thead>
              <tbody>
                {steps.map((s, i) => (
                  <tr key={i}>
                    <td className="mono">{i + 1}</td>
                    <td>{s.description}</td>
                    <td className="mono">{s.duration.toFixed(1)}</td>
                    <td><Badge tone={s.kind === "internal" ? "alarm" : "ok"}>{s.kind}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="SMED suggestion">
            <p className="text-sm">{r.suggestion}</p>
            {r.savingsIfSeparated > 0 && (
              <p className="text-xs text-steel mt-2">Best-case downtime after separating external work: <span className="mono font-semibold text-ok">{r.potentialDowntime.toFixed(1)} min</span> (−{((r.savingsIfSeparated / r.total) * 100).toFixed(0)}%).</p>
            )}
          </Card>
          <Link className="btn btn-quiet" href={`/p/${project.id}/smed?line=${encodeURIComponent(co.line)}`}>← All changeovers on {co.line}</Link>
        </div>
      </div>
    </div>
  );
}
