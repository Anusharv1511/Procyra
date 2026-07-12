import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createAudit } from "@/app/actions2";
import { getProject } from "@/lib/data";
import { terms } from "@/lib/terminology";
import { auditSummary, AuditResponse } from "@/lib/audit";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AuditList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const T = terms(project.workspace.industry);
  const runs = await db.select().from(t.auditRuns)
    .where(eq(t.auditRuns.projectId, project.id)).orderBy(desc(t.auditRuns.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Risk & compliance" title={`Audits (${T.qualityStandard})`} />
      <p className="text-xs text-steel mb-4 max-w-2xl">Illustrative self-check only: a representative subset of {T.qualityStandard}-style process-audit questions for internal walk-throughs. It is <span className="font-semibold">not</span> a certified audit tool and does not cover the standard.</p>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {runs.length === 0 ? (
            <EmptyState title="No audit walk-throughs yet"
              body="Run a quick pass/fail/N-A walk-through against a representative question set. You get a pass-rate summary, and any failed item can be turned into a CAPA action item in one click."
              cta={<Link className="btn" href="#new-audit">Start walk-through</Link>} />
          ) : runs.map(r => {
            const s = auditSummary(r.responses as Record<string, AuditResponse>);
            return (
              <Link key={r.id} href={`/p/${project.id}/audit/${r.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                <div>
                  <span className="font-semibold text-sm">{r.name}</span>
                  <span className="text-xs text-steel ml-2">{new Date(r.createdAt).toLocaleDateString()} · {s.answered}/{s.total} answered</span>
                </div>
                {s.passRatePct != null
                  ? <Badge tone={s.fail === 0 ? "ok" : s.passRatePct >= 80 ? "warn" : "alarm"}>{s.passRatePct.toFixed(0)}% pass · {s.fail} failed</Badge>
                  : <Badge tone="quiet">not scored yet</Badge>}
              </Link>
            );
          })}
        </div>
        <Card title="New walk-through" id="new-audit">
          <ActionForm action={createAudit} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="standard" value={T.qualityStandard} />
            <div><label className="label">Name</label><input className="input" name="name" required placeholder="e.g. Q3 line 2 process audit" data-kbd="new" /></div>
            <Submit>Start walk-through</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
