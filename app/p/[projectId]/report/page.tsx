// Part N — A3-style one-page report: the project's whole story (problem,
// current condition from live data, analysis, actions, follow-up) on a single
// printable page. Read-only aggregation of existing data — reuses the print
// CSS from the SPC report (Part B1).

import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { getProject } from "@/lib/data";
import { terms } from "@/lib/terminology";
import { PLAYBOOKS } from "@/lib/playbooks";
import { latestToolResult } from "@/lib/guided-data";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function A3Report({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const T = terms(project.workspace.industry);
  const [runs, alerts, capas, ncs, decisions] = await Promise.all([
    db.select().from(t.playbookRuns).where(eq(t.playbookRuns.projectId, project.id)).orderBy(desc(t.playbookRuns.createdAt)),
    db.select().from(t.alerts).where(eq(t.alerts.projectId, project.id)),
    db.select().from(t.capas).where(eq(t.capas.projectId, project.id)).orderBy(desc(t.capas.createdAt)),
    db.select().from(t.nonConformances).where(eq(t.nonConformances.projectId, project.id)),
    db.select().from(t.decisions).where(eq(t.decisions.projectId, project.id)).orderBy(desc(t.decisions.createdAt)),
  ]);
  const run = runs[0];
  const state: any = run?.state ?? {};
  const pb = run ? PLAYBOOKS[run.playbookKey] : null;
  const openAlerts = alerts.filter(a => a.status === "open");
  const openCapas = capas.filter(c => c.status !== "done");

  const byCode = new Map<string, number>();
  for (const n of ncs) byCode.set(n.defectCode, (byCode.get(n.defectCode) ?? 0) + n.qty);
  const topDefects = [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalQty = [...byCode.values()].reduce((a, b) => a + b, 0);

  const [spc, cap] = await Promise.all([
    latestToolResult(project.id, "spc"),
    latestToolResult(project.id, "capability"),
  ]);

  const box = (label: string, children: React.ReactNode) => (
    <Card title={label} className="break-inside-avoid">{children}</Card>
  );

  return (
    <div>
      <PageHeader eyebrow="Guided mode" title="A3 report" action={<PrintButton />} />
      <p className="text-xs text-steel mb-4 no-print max-w-2xl">One page, whole story — the classic A3 layout filled from this project&apos;s live data and playbook. Print / save as PDF to share with people who&apos;ll never open the app.</p>

      <div className="mb-4 card px-4 py-3 flex flex-wrap justify-between items-center gap-2">
        <div>
          <div className="eyebrow">{project.workspace.name} · {project.workspace.industry.replace("_", " ")}</div>
          <div className="font-bold">{project.name}</div>
        </div>
        <div className="text-xs text-steel mono">Printed {new Date().toLocaleDateString()}</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 print-stack">
        {box("1 · Background & problem", (
          state.define?.problem ? (
            <div className="space-y-1 text-sm">
              <p>{state.define.problem}</p>
              {state.define.goal && <p className="text-steel"><span className="font-semibold text-ink">Goal:</span> {state.define.goal}</p>}
              {state.define.scope && <p className="text-steel"><span className="font-semibold text-ink">Scope:</span> {state.define.scope}</p>}
            </div>
          ) : <p className="text-sm text-steel">No playbook problem statement yet — start a playbook run and its Define step will fill this box.</p>
        ))}

        {box("2 · Current condition (live data)", (
          <div className="space-y-2 text-sm">
            {spc && <p>{spc.summary} {spc.detail && <span className="text-steel">{spc.detail}</span>}</p>}
            {cap && <p>{cap.summary}</p>}
            {topDefects.length > 0 && (
              <p>Top {T.defects.toLowerCase()}: {topDefects.map(([c, q]) => `${c} (${q})`).join(", ")} — {totalQty} total logged.</p>
            )}
            <div className="flex gap-3 pt-1">
              <Badge tone={openAlerts.length ? "warn" : "ok"}>{openAlerts.length} open alert{openAlerts.length === 1 ? "" : "s"}</Badge>
              <Badge tone={openCapas.length ? "warn" : "ok"}>{openCapas.length} open CAPA{openCapas.length === 1 ? "" : "s"}</Badge>
            </div>
          </div>
        ))}

        {box("3 · Analysis (root cause)", (
          state.analyze?.rootCause || state.analyze?.hypotheses ? (
            <div className="space-y-1 text-sm">
              {state.analyze.hypotheses && <p><span className="font-semibold">Hypotheses:</span> {state.analyze.hypotheses}</p>}
              {state.analyze.rootCause && <p><span className="font-semibold">Verified root cause:</span> {state.analyze.rootCause}</p>}
            </div>
          ) : <p className="text-sm text-steel">Filled from the playbook&apos;s Analyze step once completed.</p>
        ))}

        {box("4 · Countermeasures (CAPAs)", (
          capas.length ? (
            <ul className="text-sm space-y-1">
              {capas.slice(0, 6).map(c => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>{c.title}</span>
                  <Badge tone={c.status === "done" ? "ok" : c.status === "in_progress" ? "accent" : "quiet"}>{c.status.replace("_", " ")}</Badge>
                </li>
              ))}
              {capas.length > 6 && <li className="text-xs text-steel">…and {capas.length - 6} more in the CAPA register.</li>}
            </ul>
          ) : <p className="text-sm text-steel">No CAPAs yet.</p>
        ))}

        {box("5 · Results & follow-up", (
          <div className="space-y-1 text-sm">
            {state.improve?.actions && <p><span className="font-semibold">Improvement actions:</span> {state.improve.actions}</p>}
            {state.control?.controls && <p><span className="font-semibold">Controls in place:</span> {state.control.controls}</p>}
            {run && <p className="text-steel">Playbook {pb?.title ?? run.playbookKey}: {run.status === "completed" ? "completed" : `active at step ${run.stepIndex + 1}`}.</p>}
            {!run && <p className="text-steel">Start a playbook to track results here.</p>}
          </div>
        ))}

        {box("6 · Key decisions (log)", (
          decisions.length ? (
            <ul className="text-sm space-y-1">
              {decisions.slice(0, 6).map(d => (
                <li key={d.id}>
                  <span className="font-semibold">{d.chosen}</span>
                  <span className="text-steel"> — {d.question}{d.decidedBy ? ` (${d.decidedBy})` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-steel">Gate decisions from playbook runs appear here.</p>
        ))}
      </div>

      <p className="text-xs text-steel mt-4 no-print">Everything on this page is a read-only view — edit the underlying data in <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/playbooks`}>Playbooks</Link>, <Link className="text-accent font-semibold hover:underline" href={`/p/${project.id}/capa`}>CAPA</Link>, or the analysis modules.</p>
    </div>
  );
}
