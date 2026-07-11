import { Card, PageHeader, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { startPlaybook } from "@/app/actions";
import { PLAYBOOKS } from "@/lib/playbooks";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Playbooks({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const runs = await db.select().from(t.playbookRuns)
    .where(eq(t.playbookRuns.projectId, project.id)).orderBy(desc(t.playbookRuns.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Guided mode" title="Playbooks" />
      <p className="text-sm text-steel max-w-2xl mb-4">
        Pick a goal, not a tool. A playbook walks the full DMAIC loop — Define, Measure, Analyze,
        Improve, Control — explaining each step, opening the right module, and stopping at decision
        gates where <em>the app suggests and your team decides</em>. Every decision is logged.
      </p>
      <div className="grid lg:grid-cols-2 gap-4">
        {Object.values(PLAYBOOKS).map(pb => (
          <Card key={pb.key} title={pb.title}>
            <p className="text-sm text-steel">{pb.goal}</p>
            <ol className="mt-3 space-y-1 text-sm">
              {pb.steps.map((s, i) => (
                <li key={s.key} className="flex gap-2">
                  <span className="mono text-xs text-steel w-5">{i + 1}.</span>
                  <span><Badge tone="accent">{s.phase}</Badge> <span className="ml-1">{s.title}</span></span>
                </li>
              ))}
            </ol>
            <ActionForm action={startPlaybook} className="mt-4">
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="key" value={pb.key} />
              <Submit>Start this playbook</Submit>
            </ActionForm>
          </Card>
        ))}
        <Card title="More playbooks — coming soon">
          <ul className="text-sm text-steel space-y-1">
            <li>Balance an assembly line <Badge tone="quiet">Phase 2</Badge></li>
            <li>Improve OEE on an asset <Badge tone="quiet">Phase 2</Badge></li>
            <li>Reduce changeover time (SMED) <Badge tone="quiet">Phase 2</Badge></li>
            <li>Assess a lifting task (NIOSH) <Badge tone="quiet">Phase 3</Badge></li>
          </ul>
        </Card>
      </div>
      {runs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-steel uppercase tracking-wide mb-2">Your runs</h2>
          <div className="space-y-2">
            {runs.map(r => {
              const pb = PLAYBOOKS[r.playbookKey];
              return (
                <Link key={r.id} href={`/p/${project.id}/playbooks/${r.id}`}
                  className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
                  <span className="text-sm font-semibold">{pb?.title ?? r.playbookKey}</span>
                  <span className="flex gap-2 items-center">
                    <Badge tone={r.status === "completed" ? "ok" : "accent"}>{r.status}</Badge>
                    <span className="text-xs text-steel mono">
                      step {Math.min(r.stepIndex + 1, pb?.steps.length ?? 1)}/{pb?.steps.length ?? "?"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
