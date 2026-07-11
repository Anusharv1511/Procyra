import { createWorkspace } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";
import { INDUSTRIES, PROCESS_TYPES } from "@/lib/terminology";

export default function Setup() {
  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <div className="card w-full max-w-lg p-6">
        <div className="eyebrow mb-1">First-run setup</div>
        <h1 className="text-xl font-bold">Tell Procyra where you work</h1>
        <p className="text-sm text-steel mt-1 mb-4">
          Your industry and process type adapt the app&apos;s terminology and defaults —
          aerospace sees &quot;non-conformities&quot; and a 1.67 Cpk threshold; food &amp; beverage sees
          &quot;deviations&quot; and batches. You can create more workspaces later.
        </p>
        <ActionForm action={createWorkspace} className="space-y-3">
          <div><label className="label" htmlFor="name">Workspace name (company / facility)</label>
            <input className="input" id="name" name="name" placeholder="e.g. Gulf Coast Plant 2" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="industry">Industry</label>
              <select className="input" id="industry" name="industry" defaultValue="general">
                {INDUSTRIES.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
              </select></div>
            <div><label className="label" htmlFor="processType">Process type</label>
              <select className="input" id="processType" name="processType" defaultValue="discrete">
                {PROCESS_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select></div>
          </div>
          <div><label className="label" htmlFor="projectName">First project</label>
            <input className="input" id="projectName" name="projectName" placeholder="e.g. Line 4 defect reduction" required /></div>
          <Submit>Create workspace</Submit>
        </ActionForm>
      </div>
    </main>
  );
}
