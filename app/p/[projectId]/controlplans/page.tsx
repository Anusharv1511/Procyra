import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addControlPlanItem, deleteControlPlanItem } from "@/app/actions2";
import { getProject } from "@/lib/data";
import { terms } from "@/lib/terminology";
import { db, t } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ControlPlansPage({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const T = terms(project.workspace.industry);
  const [items, streams, fmeas] = await Promise.all([
    db.select().from(t.controlPlanItems).where(eq(t.controlPlanItems.projectId, project.id)).orderBy(asc(t.controlPlanItems.createdAt)),
    db.select().from(t.streams).where(eq(t.streams.projectId, project.id)),
    db.select().from(t.fmeas).where(eq(t.fmeas.projectId, project.id)),
  ]);
  const fmeaItems = fmeas.length
    ? await db.select().from(t.fmeaItems).where(inArray(t.fmeaItems.fmeaId, fmeas.map(f => f.id)))
    : [];
  const streamById = Object.fromEntries(streams.map(s => [s.id, s]));
  const fmeaItemById = Object.fromEntries(fmeaItems.map(fi => [fi.id, fi]));
  const spcAndYield = streams.filter(s => s.type.startsWith("SPC") || s.type === "YIELD");

  return (
    <div>
      <PageHeader eyebrow="Risk & compliance" title="Control plans" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <EmptyState title="No controlled characteristics yet"
              body="A control plan is the register of what you check, how, how often, and what happens when it's wrong. Link each characteristic to its live SPC stream or FMEA failure mode so the plan stays tied to real data instead of living in a drawer."
              cta={<Link className="btn" href="#new-cp">Add characteristic</Link>} />
          ) : (
            <Card title={`Control plan register — ${items.length} characteristic${items.length === 1 ? "" : "s"}`}>
              <div className="overflow-x-auto">
                <table className="data">
                  <thead><tr><th>Characteristic</th><th>Spec / tolerance</th><th>Control method</th><th>Frequency</th><th>Reaction plan</th><th>Linked to</th><th></th></tr></thead>
                  <tbody>
                    {items.map(it => {
                      const st = it.linkedStreamId ? streamById[it.linkedStreamId] : null;
                      const fi = it.linkedFmeaItemId ? fmeaItemById[it.linkedFmeaItemId] : null;
                      return (
                        <tr key={it.id}>
                          <td className="font-medium">{it.characteristic}</td>
                          <td className="mono text-xs">{it.specification ?? "—"}</td>
                          <td>{it.controlMethod}</td>
                          <td className="text-xs">{it.frequency}</td>
                          <td className="text-xs text-steel">{it.reactionPlan ?? "—"}</td>
                          <td className="text-xs space-y-1">
                            {st && (
                              <div><Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/${st.type === "YIELD" ? "yield" : "spc"}/${st.id}`}>
                                {st.type === "YIELD" ? "Yield" : "SPC"}: {st.name}</Link>
                                <span className="text-steel"> (read-only link)</span></div>
                            )}
                            {fi && (
                              <div><Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/fmea/${fi.fmeaId}#${fi.id}`}>
                                FMEA: {fi.failureMode}</Link>
                                <span className="text-steel"> · RPN {fi.rpn}</span></div>
                            )}
                            {!st && !fi && "—"}
                          </td>
                          <td>
                            <ActionForm action={deleteControlPlanItem}>
                              <input type="hidden" name="projectId" value={project.id} />
                              <input type="hidden" name="id" value={it.id} />
                              <button className="text-steel hover:text-alarm text-xs" title="Remove row">✕</button>
                            </ActionForm>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <Card title="Add characteristic" id="new-cp">
          <ActionForm action={addControlPlanItem} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Characteristic</label><input className="input" name="characteristic" required placeholder="e.g. Flange OD" data-kbd="new" /></div>
            <div><label className="label">Spec / tolerance</label><input className="input" name="specification" placeholder="e.g. 25.000 ± 0.021 mm" /></div>
            <div><label className="label">Control method</label><input className="input" name="controlMethod" required placeholder="e.g. SPC I-MR chart, micrometer" /></div>
            <div><label className="label">Inspection frequency</label><input className="input" name="frequency" required placeholder="e.g. 1 per hour" /></div>
            <div><label className="label">Reaction plan</label><textarea className="input" name="reactionPlan" rows={2} placeholder={`e.g. Stop ${T.line.toLowerCase()}, quarantine since last good check, notify setter`} /></div>
            <div><label className="label">Link to data stream (optional)</label>
              <select className="input" name="linkedStreamId">
                <option value="">— none —</option>
                {spcAndYield.map(s => <option key={s.id} value={s.id}>{s.type === "YIELD" ? "Yield" : "SPC"}: {s.name}</option>)}
              </select></div>
            <div><label className="label">Link to FMEA item (optional)</label>
              <select className="input" name="linkedFmeaItemId">
                <option value="">— none —</option>
                {fmeaItems.map(fi => <option key={fi.id} value={fi.id}>{fi.processStep} — {fi.failureMode} (RPN {fi.rpn})</option>)}
              </select></div>
            <Submit>Add to control plan</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">Links are read-only references into the live SPC/FMEA modules — the control plan never edits them.</p>
        </Card>
      </div>
    </div>
  );
}
