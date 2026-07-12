import { Card, PageHeader, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { save8DStep } from "@/app/actions2";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DISCIPLINES = [
  { n: 1, title: "D1 — Establish the team", hint: "Who is on the team, who leads, what authority/skills they bring. Small and cross-functional beats large and generic." },
  { n: 2, title: "D2 — Describe the problem", hint: "What / where / when / how many — in measurable terms (is/is-not helps). No causes yet." },
  { n: 3, title: "D3 — Interim containment", hint: "Protect the customer NOW: sort, hold, 100% inspect. Record verification that containment works, and its exit criteria." },
  { n: 4, title: "D4 — Root cause analysis", hint: "Why did it occur AND why did it escape detection? 5-Why / fishbone; verify the cause by turning the problem on and off." },
  { n: 5, title: "D5 — Choose corrective actions", hint: "Actions that remove the verified root cause (occurrence and escape). Verify they work before full rollout." },
  { n: 6, title: "D6 — Implement corrective actions", hint: "Roll out, remove containment once data confirms, and monitor (SPC/yield) to prove the fix holds." },
  { n: 7, title: "D7 — Prevent recurrence", hint: "Update FMEA, control plan, standards, and similar processes/products so the whole class of problem is addressed." },
  { n: 8, title: "D8 — Congratulate the team", hint: "Recognize the team, capture lessons learned, close the record." },
];

export default async function EightDDetail({ params }: { params: { projectId: string; edId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [ed] = await db.select().from(t.eightDs).where(eq(t.eightDs.id, params.edId));
  if (!ed || ed.projectId !== project.id) notFound();
  const disc = ed.disciplines as Record<string, string>;
  const linkedCapa = ed.linkedCapaId
    ? (await db.select().from(t.capas).where(eq(t.capas.id, ed.linkedCapaId)))[0]
    : null;

  return (
    <div>
      <PageHeader eyebrow="Risk & compliance · 8D" title={ed.title} />
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Badge tone={ed.status === "closed" ? "ok" : "accent"}>{ed.status === "closed" ? "Closed" : `Working D${ed.currentStep}`}</Badge>
        {linkedCapa && (
          <span className="text-xs text-steel">Linked CAPA (read-only): <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/capa`}>{linkedCapa.title}</Link> — {linkedCapa.status.replace("_", " ")}</span>
        )}
        {ed.linkedDefectCode && (
          <span className="text-xs text-steel">Defect code: <Link className="text-accent font-semibold hover:underline mono" href={`/p/${project.id}/nc`}>{ed.linkedDefectCode}</Link></span>
        )}
      </div>
      <div className="space-y-3">
        {DISCIPLINES.map(d => {
          const saved = disc[`d${d.n}`];
          const isCurrent = ed.status !== "closed" && d.n === ed.currentStep;
          const locked = ed.status !== "closed" && d.n > ed.currentStep;
          return (
            <Card key={d.n} className={locked ? "opacity-50" : ""}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-sm font-semibold">{d.title}</h2>
                {saved && !isCurrent && <Badge tone="ok">done</Badge>}
                {isCurrent && <Badge tone="accent">current</Badge>}
                {locked && <Badge tone="quiet">locked — finish D{ed.currentStep} first</Badge>}
              </div>
              <p className="text-xs text-steel mb-2">{d.hint}</p>
              {locked ? null : isCurrent || (saved && ed.status !== "closed") ? (
                <ActionForm action={save8DStep} className="space-y-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="id" value={ed.id} />
                  <input type="hidden" name="step" value={d.n} />
                  <textarea className="input text-sm" name="text" rows={3} defaultValue={saved ?? ""}
                    data-kbd={isCurrent ? "new" : undefined} />
                  <div className="flex gap-2">
                    {isCurrent ? (
                      <>
                        <button className="btn" name="advance" value="1" type="submit">
                          {d.n === 8 ? "Save & close the 8D" : `Save & advance to D${d.n + 1}`}
                        </button>
                        <Submit quiet>Save only</Submit>
                      </>
                    ) : <Submit quiet>Update</Submit>}
                  </div>
                </ActionForm>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{saved}</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
