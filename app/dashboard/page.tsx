import AppShell from "@/components/AppShell";
import AlertList from "@/components/AlertList";
import { Card, PageHeader, Stat, EmptyState } from "@/components/ui";
import { GLOSSARY } from "@/lib/glossary";
import { getSessionUser } from "@/lib/auth";
import { myProjects, openAlerts, dueTasks } from "@/lib/data";
import { db, t } from "@/db";
import { asc, inArray } from "drizzle-orm";
import { xbarRLimits, imrLimits, capability, oee, mean, range } from "@/lib/spc";
import HelpTip from "@/components/HelpTip";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = await myProjects();
  if (!projects.length) redirect("/setup");
  const ids = projects.map(p => p.id);
  const [alerts, tasks] = await Promise.all([openAlerts(ids), dueTasks(ids)]);
  const names = Object.fromEntries(projects.map(p => [p.id, p.name]));
  const critical = alerts.filter(a => a.severity === "critical").length;

  // Fix 9 — at-a-glance tiles: worst current Cpk across SPC streams and the
  // most recent OEE % logged. Reuses the exact same lib/spc functions the
  // capability report and OEE pages already use — no new calculation logic.
  const streams = ids.length
    ? await db.select().from(t.streams).where(inArray(t.streams.projectId, ids))
    : [];
  const spcStreams = streams.filter(s => s.type.startsWith("SPC") && (s.specLow != null || s.specHigh != null));
  const oeeStreams = streams.filter(s => s.type === "OEE");
  const relevantIds = [...spcStreams, ...oeeStreams].map(s => s.id);
  const pts = relevantIds.length
    ? await db.select().from(t.dataPoints)
        .where(inArray(t.dataPoints.streamId, relevantIds))
        .orderBy(asc(t.dataPoints.ts), asc(t.dataPoints.createdAt))
    : [];

  let worstCpk: { value: number; stream: (typeof streams)[number] } | null = null;
  for (const s of spcStreams) {
    const sp = pts.filter(p => p.streamId === s.id);
    const valuesPer = sp.map(p => ((p.payload as any).values as number[]) ?? []);
    const all = valuesPer.flat();
    if (all.length < 10) continue; // same minimum the capability page uses
    const isXbar = s.type === "SPC_XBAR_R";
    const lim = isXbar
      ? xbarRLimits(valuesPer.map(mean), valuesPer.map(range), s.subgroupSize)
      : imrLimits(valuesPer.map(v => v[0]));
    const cap = capability(all, lim.sigmaWithin, s.specLow, s.specHigh);
    if (cap.cpk != null && (!worstCpk || cap.cpk < worstCpk.value)) worstCpk = { value: cap.cpk, stream: s };
  }

  let latestOee: { value: number; ts: Date; stream: (typeof streams)[number] } | null = null;
  for (const s of oeeStreams) {
    const sp = pts.filter(p => p.streamId === s.id);
    const last = sp[sp.length - 1];
    if (!last) continue;
    const c = (last.computed as any)?.oee != null ? (last.computed as any) : oee(last.payload as any);
    if (!latestOee || +new Date(last.ts) > +latestOee.ts) latestOee = { value: c.oee, ts: new Date(last.ts), stream: s };
  }
  const cpkTone = worstCpk ? (worstCpk.value >= worstCpk.stream.cpkThreshold ? "text-ok" : worstCpk.value >= 1 ? "text-warn" : "text-alarm") : "text-ink";
  const oeeTone = latestOee ? (latestOee.value >= (latestOee.stream.target ?? 0.85) ? "text-ok" : "text-warn") : "text-ink";

  return (
    <AppShell userName={user.name}>
      <PageHeader eyebrow="All projects" title="Dashboard" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat label="Open alerts" value={String(alerts.length)} tone={alerts.length ? "warn" : "ok"} />
        <Stat label="Critical" value={String(critical)} tone={critical ? "alarm" : "ok"} />
        <Stat label="Tasks due ≤3 days" value={String(tasks.length)} tone={tasks.length ? "warn" : "ok"} />
        <Stat label="Projects" value={String(projects.length)} />
      </div>
      {(worstCpk || latestOee) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {worstCpk && (
            <Link href={`/p/${worstCpk.stream.projectId}/capability?stream=${worstCpk.stream.id}`} className="card px-4 py-3 hover:shadow-sm">
              <div className="eyebrow">Worst Cpk<HelpTip text={GLOSSARY.cpk} term="Cpk" /></div>
              <div className={`mono text-xl font-bold ${cpkTone}`}>{worstCpk.value.toFixed(2)}</div>
              <div className="text-xs text-steel truncate">{worstCpk.stream.name} →</div>
            </Link>
          )}
          {latestOee && (
            <Link href={`/p/${latestOee.stream.projectId}/oee/${latestOee.stream.id}`} className="card px-4 py-3 hover:shadow-sm">
              <div className="eyebrow">Latest OEE<HelpTip text={GLOSSARY.oee} term="OEE" /></div>
              <div className={`mono text-xl font-bold ${oeeTone}`}>{(latestOee.value * 100).toFixed(1)}%</div>
              <div className="text-xs text-steel truncate">{latestOee.stream.name} · {latestOee.ts.toLocaleDateString()} →</div>
            </Link>
          )}
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Alert inbox">
            <AlertList alerts={alerts as any} projectNames={names} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Due & upcoming tasks">
            {tasks.length === 0 ? (
              <p className="text-sm text-steel">Nothing due in the next 3 days.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {tasks.map(x => {
                  const overdue = new Date(x.nextDue).getTime() < Date.now();
                  return (
                    <li key={x.id}>
                      <Link href={`/p/${x.projectId}/tasks`} className="hover:underline">
                        <span className={overdue ? "text-alarm font-semibold" : ""}>{x.title}</span>
                        <span className="text-steel"> — {new Date(x.nextDue).toLocaleDateString()}{overdue ? " (overdue)" : ""}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Projects">
            <ul className="space-y-1 text-sm">
              {projects.map(p => (
                <li key={p.id}>
                  <Link className="text-accent font-semibold hover:underline" href={`/p/${p.id}`}>{p.name}</Link>
                  <span className="text-steel"> · {p.workspace.name}</span>
                </li>
              ))}
            </ul>
            <Link href="/projects" className="btn btn-quiet mt-3">Manage projects</Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
