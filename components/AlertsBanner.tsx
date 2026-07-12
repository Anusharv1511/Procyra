// Fix 6 — small persistent banner shown at the top of the module page where
// alerts actually originate (SPC, Capability, FMEA, OEE). Purely surfaces what
// already exists in the alerts table — no new alert logic.

import { db, t } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";

export default async function AlertsBanner({
  projectId, sourceTypes, streamId, scopeLabel, inboxCategory,
}: {
  projectId: string;
  /** filter open alerts to these source types (e.g. ["SPC"]) */
  sourceTypes?: string[];
  /** or filter to a specific stream (covers SPC + CAPABILITY alerts on it) */
  streamId?: string;
  /** e.g. "this stream", "this project's FMEAs" */
  scopeLabel: string;
  /** pre-filters the project alert inbox by category when following the link */
  inboxCategory?: string;
}) {
  const conds = [eq(t.alerts.projectId, projectId), eq(t.alerts.status, "open")];
  if (streamId) conds.push(eq(t.alerts.streamId, streamId));
  else if (sourceTypes?.length) conds.push(inArray(t.alerts.sourceType, sourceTypes));

  const rows = await db.select({ id: t.alerts.id, severity: t.alerts.severity })
    .from(t.alerts).where(and(...conds));
  if (!rows.length) return null;

  const critical = rows.filter(r => r.severity === "critical").length;
  const href = `/p/${projectId}${inboxCategory ? `?cat=${encodeURIComponent(inboxCategory)}` : ""}#alert-inbox`;
  const tone = critical
    ? "border-red-200 bg-red-50 text-alarm"
    : "border-amber-200 bg-amber-50 text-warn";

  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${tone}`}>
      <span>
        {rows.length} open alert{rows.length === 1 ? "" : "s"} for {scopeLabel}
        {critical ? ` — ${critical} critical` : ""}
      </span>
      <Link href={href} className="underline hover:no-underline">View in alert inbox →</Link>
    </div>
  );
}
