"use client";

// Fix 9 — the shared Alert inbox list, used on both the Dashboard and each
// Project Overview page. Adds: a filter bar (project / category / severity),
// a severity-colored left border on every card so "Critical: N" visibly maps
// to cards, a filter-scoped "Resolve all" with confirmation, and grouping of
// Western Electric alerts that fired from the same SPC entry into one card.
// No alert logic changed — this only presents what's already in the table.

import { useMemo, useState } from "react";
import { setAlertStatus, resolveAlerts } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Badge } from "@/components/ui";

type Alert = {
  id: string; projectId: string; streamId: string | null;
  sourceType: string; sourceId: string | null; ruleCode: string;
  severity: string; message: string; status: string; createdAt: string | Date;
};

const toneOf = (sev: string) =>
  sev === "critical" ? ("alarm" as const) : sev === "warning" ? ("warn" as const) : ("quiet" as const);
const borderOf = (sev: string) =>
  sev === "critical" ? "var(--alarm)" : sev === "warning" ? "var(--warn)" : "var(--line)";

function ResolveOne({ a }: { a: Alert }) {
  return (
    <ActionForm action={setAlertStatus}>
      <input type="hidden" name="projectId" value={a.projectId} />
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="status" value="resolved" />
      <Submit quiet>Resolve</Submit>
    </ActionForm>
  );
}

export default function AlertList({ alerts, projectNames, initialCategory }: {
  alerts: Alert[];
  projectNames?: Record<string, string>;
  initialCategory?: string;
}) {
  const categories = useMemo(() => Array.from(new Set(alerts.map(a => a.sourceType))).sort(), [alerts]);
  const [project, setProject] = useState("all");
  const [category, setCategory] = useState(
    initialCategory && categories.includes(initialCategory) ? initialCategory : "all");
  const [severity, setSeverity] = useState("all");

  if (!alerts.length) {
    return <p className="text-sm text-steel">No open alerts. When a rule fires — an out-of-control point, a Cpk drop, a repeated defect — it appears here.</p>;
  }

  const filtered = alerts.filter(a =>
    (project === "all" || a.projectId === project) &&
    (category === "all" || a.sourceType === category) &&
    (severity === "all" || a.severity === severity));

  // Group SPC rule alerts that fired from the same logged entry (same sourceId)
  // into one card listing all violated rules, instead of 2–4 near-identical cards.
  type Group = { key: string; items: Alert[] };
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  for (const a of filtered) {
    const key = a.sourceType === "SPC" && a.sourceId ? `spc:${a.sourceId}` : a.id;
    const g = byKey.get(key);
    if (g) g.items.push(a);
    else { const ng = { key, items: [a] }; byKey.set(key, ng); groups.push(ng); }
  }

  const filterActive = project !== "all" || category !== "all" || severity !== "all";

  return (
    <div>
      {/* filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {projectNames && (
          <select className="input !w-auto !py-1 !text-xs" value={project} onChange={e => setProject(e.target.value)} aria-label="Filter by project">
            <option value="all">All projects</option>
            {Object.entries(projectNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <select className="input !w-auto !py-1 !text-xs" value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input !w-auto !py-1 !text-xs" value={severity} onChange={e => setSeverity(e.target.value)} aria-label="Filter by severity">
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
        </select>
        <span className="text-steel">{filtered.length} of {alerts.length} shown</span>
        {filtered.length > 0 && (
          <span className="ml-auto">
            <ActionForm action={resolveAlerts}>
              <input type="hidden" name="ids" value={filtered.map(a => a.id).join(",")} />
              <button
                type="submit"
                className="btn btn-quiet !py-1 !text-xs"
                onClick={e => {
                  const msg = filterActive
                    ? `Resolve all ${filtered.length} currently-filtered alert${filtered.length === 1 ? "" : "s"}?`
                    : `Resolve all ${filtered.length} open alert${filtered.length === 1 ? "" : "s"}?`;
                  if (!confirm(msg)) e.preventDefault();
                }}
              >
                Resolve all ({filtered.length})
              </button>
            </ActionForm>
          </span>
        )}
      </div>

      {!filtered.length ? (
        <p className="text-sm text-steel">No open alerts match the current filter.</p>
      ) : (
        <ul className="space-y-2">
          {groups.map(g => {
            const first = g.items[0];
            const grouped = g.items.length > 1;
            const worst = g.items.some(a => a.severity === "critical") ? "critical"
              : g.items.some(a => a.severity === "warning") ? "warning" : first.severity;
            return (
              <li key={g.key} className="card px-4 py-3 flex items-start justify-between gap-3 flex-wrap border-l-4"
                style={{ borderLeftColor: borderOf(worst) }}>
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    {g.items.map(a => <Badge key={a.id} tone={toneOf(a.severity)}>{a.ruleCode}</Badge>)}
                    <Badge tone="quiet">{first.sourceType}</Badge>
                    {projectNames?.[first.projectId] && <Badge tone="accent">{projectNames[first.projectId]}</Badge>}
                    {grouped && <span className="text-[11px] text-steel">{g.items.length} rules from the same entry</span>}
                  </div>
                  {grouped ? (
                    <ul className="text-sm mt-1 space-y-0.5">
                      {g.items.map(a => <li key={a.id}>{a.message}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm mt-1">{first.message}</p>
                  )}
                  <p className="text-xs text-steel mt-0.5 mono">{new Date(first.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {grouped ? (
                    <ActionForm action={resolveAlerts}>
                      <input type="hidden" name="ids" value={g.items.map(a => a.id).join(",")} />
                      <Submit quiet>Resolve all {g.items.length}</Submit>
                    </ActionForm>
                  ) : (
                    <ResolveOne a={first} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
