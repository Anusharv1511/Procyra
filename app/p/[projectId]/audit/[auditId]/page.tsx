import { Card, PageHeader, Stat } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveAuditResponses, capaFromAuditItem } from "@/app/actions2";
import { getProject } from "@/lib/data";
import { AUDIT_QUESTIONS, auditSummary, AuditResponse } from "@/lib/audit";
import { db, t } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuditDetail({ params }: { params: { projectId: string; auditId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const [run] = await db.select().from(t.auditRuns).where(eq(t.auditRuns.id, params.auditId));
  if (!run || run.projectId !== project.id) notFound();
  const responses = run.responses as Record<string, AuditResponse>;
  const s = auditSummary(responses);

  return (
    <div>
      <PageHeader eyebrow={`Risk & compliance · audit (${run.standard})`} title={run.name} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Pass rate" value={s.passRatePct != null ? `${s.passRatePct.toFixed(0)}%` : "—"}
          tone={s.passRatePct == null ? undefined : s.fail === 0 ? "ok" : s.passRatePct >= 80 ? "warn" : "alarm"}
          help="Pass ÷ (pass + fail). N/A answers are excluded." />
        <Stat label="Pass" value={String(s.pass)} tone="ok" />
        <Stat label="Fail" value={String(s.fail)} tone={s.fail ? "alarm" : undefined} />
        <Stat label="N/A" value={String(s.na)} />
      </div>
      <Card title="Checklist (illustrative subset — not a certified audit)">
        <ActionForm action={saveAuditResponses} className="space-y-1">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="id" value={run.id} />
          <div className="overflow-x-auto">
            <table className="data">
              <thead><tr><th>Clause</th><th>Question</th><th>Result</th><th>Notes</th></tr></thead>
              <tbody>
                {AUDIT_QUESTIONS.map(q => {
                  const r = responses[q.id];
                  return (
                    <tr key={q.id}>
                      <td className="mono text-xs">{q.clause}</td>
                      <td className="text-sm max-w-md">{q.text}</td>
                      <td>
                        <div className="flex gap-2 text-xs">
                          {(["pass", "fail", "na"] as const).map(v => (
                            <label key={v} className="inline-flex items-center gap-1 cursor-pointer">
                              <input type="radio" name={`result_${q.id}`} value={v} defaultChecked={r?.result === v} />
                              <span className={v === "pass" ? "text-ok font-semibold" : v === "fail" ? "text-alarm font-semibold" : "text-steel"}>{v === "na" ? "N/A" : v}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="!p-1"><input className="input !py-1 text-xs" name={`note_${q.id}`} defaultValue={r?.note ?? ""} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pt-3"><Submit>Save responses</Submit></div>
        </ActionForm>
      </Card>
      {s.failedQuestions.length > 0 && (
        <Card title="Failed items → action items" className="mt-4">
          <ul className="space-y-2">
            {s.failedQuestions.map(q => (
              <li key={q.id} className="flex items-center justify-between gap-3 text-sm">
                <span><span className="mono text-xs text-steel">{q.clause}</span> {q.text}{responses[q.id]?.note ? <span className="text-steel text-xs"> — {responses[q.id].note}</span> : null}</span>
                <ActionForm action={capaFromAuditItem}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="title" value={`[Audit ${run.name}] ${q.clause}: ${q.text.slice(0, 140)}`} />
                  <Submit quiet>Draft CAPA</Submit>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
