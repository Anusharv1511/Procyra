import { Card, PageHeader, EmptyState } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addChangeover } from "@/app/actions2";
import JsonRowsInput from "@/components/JsonRowsInput";
import TrendLine from "@/components/charts/TrendLine";
import { getProject } from "@/lib/data";
import { smedAnalysis, ChangeoverStep } from "@/lib/smed";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SmedList({ params, searchParams }: {
  params: { projectId: string }; searchParams: { line?: string };
}) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const all = await db.select().from(t.changeovers)
    .where(eq(t.changeovers.projectId, project.id)).orderBy(asc(t.changeovers.date));
  const lines = Array.from(new Set(all.map(c => c.line)));
  const line = searchParams.line && lines.includes(searchParams.line) ? searchParams.line : lines[0];
  const filtered = all.filter(c => c.line === line);
  const trend = filtered.map(c => {
    const r = smedAnalysis(c.steps as ChangeoverStep[]);
    return {
      label: new Date(c.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      total: Number(r.total.toFixed(1)), internal: Number(r.internal.toFixed(1)), external: Number(r.external.toFixed(1)),
    };
  });

  return (
    <div>
      <PageHeader eyebrow="Monitor & track" title="SMED / changeover" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {all.length === 0 ? (
            <EmptyState title="No changeovers logged yet"
              body="Log a changeover's steps with their durations, classified internal (machine stopped) or external (can be done while running). The analysis shows where the downtime really goes and what the first SMED move — separating external work out of the stop — would save."
              cta={<Link className="btn" href="#new-co">Log a changeover</Link>} />
          ) : (
            <>
              {lines.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {lines.map(l => (
                    <Link key={l} href={`/p/${project.id}/smed?line=${encodeURIComponent(l)}`}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${l === line ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-white text-steel border-line hover:bg-paper"}`}>
                      {l}
                    </Link>
                  ))}
                </div>
              )}
              {trend.length > 1 && (
                <Card title={`Changeover trend — ${line}`}>
                  <TrendLine data={trend} unit="min" series={[
                    { key: "total", label: "Total", color: "var(--accent)" },
                    { key: "internal", label: "Internal (stopped)", color: "var(--alarm)" },
                    { key: "external", label: "External", color: "var(--ok)" },
                  ]} />
                </Card>
              )}
              <Card title={`Changeovers — ${line}`}>
                <table className="data">
                  <thead><tr><th>Date</th><th>Steps</th><th>Total (min)</th><th>Internal</th><th>External</th><th></th></tr></thead>
                  <tbody>
                    {filtered.slice().reverse().map(c => {
                      const r = smedAnalysis(c.steps as ChangeoverStep[]);
                      return (
                        <tr key={c.id}>
                          <td className="mono text-xs">{new Date(c.date).toLocaleDateString()}</td>
                          <td className="mono">{(c.steps as any[]).length}</td>
                          <td className="mono font-semibold">{r.total.toFixed(1)}</td>
                          <td className="mono text-alarm">{r.internal.toFixed(1)}</td>
                          <td className="mono text-ok">{r.external.toFixed(1)}</td>
                          <td><Link className="text-accent font-semibold hover:underline text-xs" href={`/p/${project.id}/smed/${c.id}`}>Analyze →</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
        <Card title="Log a changeover" id="new-co">
          <ActionForm action={addChangeover} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">Line / machine</label>
              <input className="input" name="line" required placeholder="e.g. CNC lathe 2" defaultValue={line ?? ""} data-kbd="new" list="smed-lines" />
              <datalist id="smed-lines">{lines.map(l => <option key={l} value={l} />)}</datalist></div>
            <div><label className="label">Date</label><input className="input" name="date" type="date" /></div>
            <div>
              <label className="label">Steps</label>
              <JsonRowsInput name="rows" addLabel="+ Add step" min={1}
                columns={[
                  { key: "description", label: "Step", placeholder: "e.g. Fetch tooling cart" },
                  { key: "duration", label: "Min", type: "number", width: "64px", placeholder: "5" },
                  { key: "kind", label: "Type", type: "select", width: "104px", options: [
                    { value: "internal", label: "Internal" }, { value: "external", label: "External" },
                  ] },
                ]} />
            </div>
            <p className="text-xs text-steel">Internal = only possible with the machine stopped. External = could be done while it still runs (fetching, pre-heating, paperwork).</p>
            <Submit>Log changeover</Submit>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
