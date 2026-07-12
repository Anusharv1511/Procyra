import { Card, PageHeader, Badge } from "@/components/ui";
import FmeaItemForm from "@/components/FmeaItemForm";
import AlertsBanner from "@/components/AlertsBanner";
import HelpTip from "@/components/HelpTip";
import { GLOSSARY } from "@/lib/glossary";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FmeaDetail({ params }: { params: { projectId: string; fmeaId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [fmea] = await db.select().from(t.fmeas).where(eq(t.fmeas.id, params.fmeaId));
  if (!fmea || fmea.projectId !== project.id) notFound();
  const items = (await db.select().from(t.fmeaItems).where(eq(t.fmeaItems.fmeaId, fmea.id)))
    .sort((a, b) => b.rpn - a.rpn); // auto-resort: highest risk always on top

  // Fix 2 (nice-to-have) — for each linked defect code, count the defects
  // already logged with that code, as a prompt to revisit Occurrence manually.
  const codes = Array.from(new Set(items.map(i => i.linkedDefectCode).filter(Boolean))) as string[];
  const ncCounts: Record<string, number> = {};
  if (codes.length) {
    const rows = await db.select({
      code: t.nonConformances.defectCode,
      n: sql<number>`coalesce(sum(${t.nonConformances.qty}), 0)`,
    }).from(t.nonConformances)
      .where(and(eq(t.nonConformances.projectId, project.id), inArray(t.nonConformances.defectCode, codes)))
      .groupBy(t.nonConformances.defectCode);
    for (const r of rows) ncCounts[r.code] = Number(r.n);
  }

  return (
    <div>
      <PageHeader eyebrow={`Risk & compliance · ${fmea.type}`} title={fmea.name} />
      <AlertsBanner projectId={project.id} sourceTypes={["FMEA"]} scopeLabel="this project's FMEAs" inboxCategory="FMEA" />
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card title={`Register — sorted by RPN, action threshold ${fmea.rpnAction}`}>
            <div className="overflow-x-auto">
              <table className="data">
                <thead><tr><th>Step</th><th>Failure mode</th><th>Effect / cause</th><th>S</th><th>O</th><th>D</th>
                  <th>RPN<HelpTip text={GLOSSARY.rpn} term="RPN" /></th><th>Action</th></tr></thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} id={`fmea-item-${it.id}`} className={it.rpn >= fmea.rpnAction ? "bg-red-50" : ""}>
                      <td>{it.processStep}</td>
                      <td className="font-semibold">{it.failureMode}
                        {it.linkedDefectCode && (
                          <div>
                            <Badge tone="quiet">↔ {it.linkedDefectCode}</Badge>
                            <span className="block text-[11px] text-steel mt-0.5">
                              {ncCounts[it.linkedDefectCode] ?? 0} defect{(ncCounts[it.linkedDefectCode] ?? 0) === 1 ? "" : "s"} logged with this code — does O still match?
                            </span>
                          </div>
                        )}</td>
                      <td className="text-steel text-xs">{[it.effect, it.cause].filter(Boolean).join(" / ")}</td>
                      <td className="mono">{it.severity}</td>
                      <td className="mono">{it.occurrence}</td>
                      <td className="mono">{it.detection}</td>
                      <td className={`mono font-bold ${it.rpn >= fmea.rpnAction ? "text-alarm" : ""}`}>{it.rpn}</td>
                      <td className="text-xs">{it.recommendedAction ?? "—"}
                        {it.actionStatus !== "none" && <div><Badge tone={it.actionStatus === "done" ? "ok" : "warn"}>{it.actionStatus}</Badge></div>}</td>
                    </tr>
                  ))}
                  {!items.length && <tr><td colSpan={8} className="text-steel">No failure modes yet — add the first one.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-steel mt-2">RPN = S × O × D, recomputed server-side on every save; rows re-sort automatically. Items at or above {fmea.rpnAction} are highlighted and raise an alert. Link a defect code for traceability — Occurrence (O) does not update automatically; revisit it manually as real defect data comes in.</p>
          </Card>
        </div>
        <Card title="Add failure mode">
          <FmeaItemForm projectId={project.id} fmeaId={fmea.id} />
        </Card>
      </div>
    </div>
  );
}
