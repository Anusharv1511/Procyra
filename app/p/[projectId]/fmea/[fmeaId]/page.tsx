import { Card, PageHeader, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { upsertFmeaItem } from "@/app/actions";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function ScoreInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: number }) {
  return (
    <div>
      <label className="label">{label} (1–10)</label>
      <input className="input mono" name={name} type="number" min={1} max={10} defaultValue={defaultValue ?? 5} required />
    </div>
  );
}

export default async function FmeaDetail({ params }: { params: { projectId: string; fmeaId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [fmea] = await db.select().from(t.fmeas).where(eq(t.fmeas.id, params.fmeaId));
  if (!fmea || fmea.projectId !== project.id) notFound();
  const items = (await db.select().from(t.fmeaItems).where(eq(t.fmeaItems.fmeaId, fmea.id)))
    .sort((a, b) => b.rpn - a.rpn); // auto-resort: highest risk always on top

  return (
    <div>
      <PageHeader eyebrow={`Risk & compliance · ${fmea.type}`} title={fmea.name} />
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card title={`Register — sorted by RPN, action threshold ${fmea.rpnAction}`}>
            <div className="overflow-x-auto">
              <table className="data">
                <thead><tr><th>Step</th><th>Failure mode</th><th>Effect / cause</th><th>S</th><th>O</th><th>D</th><th>RPN</th><th>Action</th></tr></thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className={it.rpn >= fmea.rpnAction ? "bg-red-50" : ""}>
                      <td>{it.processStep}</td>
                      <td className="font-semibold">{it.failureMode}
                        {it.linkedDefectCode && <div><Badge tone="quiet">↔ {it.linkedDefectCode}</Badge></div>}</td>
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
            <p className="text-xs text-steel mt-2">RPN = S × O × D, recomputed server-side on every save; rows re-sort automatically. Items at or above {fmea.rpnAction} are highlighted and raise an alert. Link a defect code to tie occurrence scores to real logged data.</p>
          </Card>
        </div>
        <Card title="Add failure mode">
          <ActionForm action={upsertFmeaItem} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="fmeaId" value={fmea.id} />
            <div><label className="label">Process step</label><input className="input" name="processStep" required /></div>
            <div><label className="label">Failure mode</label><input className="input" name="failureMode" required /></div>
            <div><label className="label">Effect</label><input className="input" name="effect" /></div>
            <div><label className="label">Cause</label><input className="input" name="cause" /></div>
            <div className="grid grid-cols-3 gap-2">
              <ScoreInput name="severity" label="S" />
              <ScoreInput name="occurrence" label="O" />
              <ScoreInput name="detection" label="D" />
            </div>
            <div><label className="label">Recommended action</label><input className="input" name="recommendedAction" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Action status</label>
                <select className="input" name="actionStatus"><option value="none">none</option><option value="open">open</option><option value="done">done</option></select></div>
              <div><label className="label">Linked defect code</label><input className="input" name="linkedDefectCode" placeholder="optional" /></div>
            </div>
            <Submit>Save item</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
