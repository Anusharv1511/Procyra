import { setAlertStatus } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Badge } from "@/components/ui";

const toneOf = (sev: string) => (sev === "critical" ? ("alarm" as const) : sev === "warning" ? ("warn" as const) : ("quiet" as const));

export default function AlertList({ alerts, projectNames }: {
  alerts: any[]; projectNames?: Record<string, string>;
}) {
  if (!alerts.length) return <p className="text-sm text-steel">No open alerts. When a rule fires — an out-of-control point, a Cpk drop, a repeated defect — it appears here.</p>;
  return (
    <ul className="space-y-2">
      {alerts.map(a => (
        <li key={a.id} className="card px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex gap-2 items-center flex-wrap">
              <Badge tone={toneOf(a.severity)}>{a.ruleCode}</Badge>
              <Badge tone="quiet">{a.sourceType}</Badge>
              {projectNames?.[a.projectId] && <Badge tone="accent">{projectNames[a.projectId]}</Badge>}
            </div>
            <p className="text-sm mt-1">{a.message}</p>
            <p className="text-xs text-steel mt-0.5 mono">{new Date(a.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <ActionForm action={setAlertStatus}>
              <input type="hidden" name="projectId" value={a.projectId} />
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value="resolved" />
              <Submit quiet>Resolve</Submit>
            </ActionForm>
          </div>
        </li>
      ))}
    </ul>
  );
}
