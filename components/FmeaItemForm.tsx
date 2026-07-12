"use client";

// Fix 5 — wraps the "Add failure mode" form so a near-duplicate (same process
// step + failure mode, case-insensitive, in this FMEA) triggers a warning with
// a choice: save as a new row anyway, or jump to the existing row. The save is
// never blocked, only confirmed.

import { useFormState, useFormStatus } from "react-dom";
import { upsertFmeaItem } from "@/app/actions";

function ScoreInput({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="label">{label} (1–10)</label>
      <input className="input mono" name={name} type="number" min={1} max={10} defaultValue={5} required />
    </div>
  );
}

function SubmitBtn({ children, quiet, name, value }: {
  children: React.ReactNode; quiet?: boolean; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending}
      className={quiet ? "btn btn-quiet" : "btn"}>
      {pending ? "Working…" : children}
    </button>
  );
}

export default function FmeaItemForm({ projectId, fmeaId }: { projectId: string; fmeaId: string }) {
  const [state, formAction] = useFormState(upsertFmeaItem as any, null as any);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="fmeaId" value={fmeaId} />
      <div><label className="label">Process step</label><input className="input" name="processStep" required /></div>
      <div><label className="label">Failure mode</label><input className="input" name="failureMode" required /></div>
      <div><label className="label">Effect</label><input className="input" name="effect" /></div>
      <div><label className="label">Cause</label><input className="input" name="cause" /></div>
      <div className="grid grid-cols-3 gap-2">
        <ScoreInput name="severity" label="S" />
        <ScoreInput name="occurrence" label="O" />
        <ScoreInput name="detection" label="D" />
      </div>
      <div><label className="label">Recommended action</label><input className="input" name="recommendedAction" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Action status</label>
          <select className="input" name="actionStatus"><option value="none">none</option><option value="open">open</option><option value="done">done</option></select></div>
        <div><label className="label">Linked defect code</label><input className="input" name="linkedDefectCode" placeholder="optional" /></div>
      </div>

      {state?.duplicate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-warn">A similar failure mode already exists</p>
          <p className="text-xs text-ink">
            “{state.duplicate.failureMode}” at step “{state.duplicate.processStep}” (RPN {state.duplicate.rpn}).
            Save as a new row anyway, or open the existing one to edit?
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <SubmitBtn name="confirmDuplicate" value="1" quiet>Save as new row anyway</SubmitBtn>
            <a href={`#fmea-item-${state.duplicate.id}`} className="btn btn-quiet">View existing row</a>
          </div>
        </div>
      ) : (
        <SubmitBtn>Save item</SubmitBtn>
      )}

      {state?.error && <p className="mt-2 text-sm font-medium text-alarm">{state.error}</p>}
      {state?.ok && state.message && <p className="mt-2 text-sm font-medium text-ok">{state.message}</p>}
    </form>
  );
}
