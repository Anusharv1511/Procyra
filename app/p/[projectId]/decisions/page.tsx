import { Card, PageHeader, EmptyState } from "@/components/ui";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Decisions({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const rows = await db.select().from(t.decisions)
    .where(eq(t.decisions.projectId, project.id)).orderBy(desc(t.decisions.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Risk & compliance" title="Decision log" />
      {rows.length === 0 ? (
        <EmptyState title="No decisions recorded yet"
          body="Every decision gate in a guided playbook lands here: what the app suggested, what the team chose, who decided, and why. An audit-friendly trail of judgment calls."
          cta={<Link className="btn" href={`/p/${project.id}/playbooks`}>Start a guided playbook</Link>} />
      ) : (
        <div className="space-y-3">
          {rows.map(d => (
            <Card key={d.id}>
              <p className="text-sm font-semibold">{d.question}</p>
              <p className="text-sm mt-1"><span className="text-steel">Team decided:</span> <span className="font-semibold">{d.chosen}</span></p>
              {d.rationale && <p className="text-sm text-steel mt-1">Rationale: {d.rationale}</p>}
              <p className="text-xs text-steel mt-2 mono">
                {d.decidedBy ? `${d.decidedBy} · ` : ""}{new Date(d.createdAt).toLocaleString()} · gate {d.gateKey}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
