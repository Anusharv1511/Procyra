import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { createLineBalance } from "@/app/actions2";
import AlertsBanner from "@/components/AlertsBanner";
import { getProject } from "@/lib/data";
import { db, t } from "@/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LineBalanceList({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const studies = await db.select().from(t.lineBalances)
    .where(eq(t.lineBalances.projectId, project.id)).orderBy(desc(t.lineBalances.createdAt));

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule" title="Line balancing" />
      <AlertsBanner projectId={project.id} sourceTypes={["LINE_BALANCE"]} scopeLabel="this project's line-balance studies" inboxCategory="LINE_BALANCE" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {studies.length === 0 ? (
            <EmptyState title="No line-balance studies yet"
              body="Enter your available time and required output to get takt time, then add stations with their cycle times — utilization, idle time, bottleneck, line efficiency and balance delay are computed instantly, and any station slower than takt raises an alert."
              cta={<Link className="btn" href="#new-lb">Create study</Link>} />
          ) : studies.map(lb => (
            <Link key={lb.id} href={`/p/${project.id}/linebalance/${lb.id}`} className="card px-4 py-3 flex justify-between items-center hover:shadow-sm">
              <span className="font-semibold text-sm">{lb.name}</span>
              <span className="text-xs text-steel mono">{(lb.stations as any[]).length} stations · takt {(lb.availableTime / lb.requiredOutput).toFixed(1)}</span>
            </Link>
          ))}
        </div>
        <Card title="New line-balance study" id="new-lb">
          <ActionForm action={createLineBalance} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Name</label><input className="input" name="name" required placeholder="e.g. Final assembly — shift 1" data-kbd="new" /></div>
            <div><label className="label">Available time per period (min)</label><input className="input mono" name="availableTime" type="number" step="any" required placeholder="e.g. 450" /></div>
            <div><label className="label">Required output per period (units)</label><input className="input mono" name="requiredOutput" type="number" step="any" required placeholder="e.g. 400" /></div>
            <Submit>Create study</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">Takt time = available time ÷ required output. Use the same time unit (usually minutes) for available time and station cycle times.</p>
        </Card>
      </div>
    </div>
  );
}
