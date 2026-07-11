"use client";

// Fix 10 — row-level "⋯" menu on the Projects table: Rename and Archive.
// Archive is a soft-delete (sets archived_at, hides from default lists);
// there is deliberately no permanent delete here. Archived rows get Restore.

import { renameProject, setProjectArchived } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";

export default function ProjectRowActions({ projectId, name, archived }: {
  projectId: string; name: string; archived?: boolean;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer select-none rounded border border-line bg-white px-2 py-0.5 text-sm text-steel hover:text-ink list-none" aria-label={`Actions for ${name}`}>⋯</summary>
      <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-line bg-white p-3 shadow-md space-y-3">
        <ActionForm action={renameProject} className="space-y-2">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="label" htmlFor={`rename-${projectId}`}>Rename project</label>
          <input id={`rename-${projectId}`} className="input" name="name" defaultValue={name} required />
          <Submit quiet>Save name</Submit>
        </ActionForm>
        <div className="border-t border-line pt-2">
          <ActionForm action={setProjectArchived}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="archived" value={archived ? "0" : "1"} />
            {archived ? (
              <Submit quiet>Restore project</Submit>
            ) : (
              <button
                type="submit"
                className="btn btn-quiet"
                onClick={e => {
                  if (!confirm(`Archive “${name}”? It will be hidden from your project lists but nothing is deleted — you can restore it any time from “Show archived”.`))
                    e.preventDefault();
                }}
              >
                Archive project
              </button>
            )}
          </ActionForm>
          {!archived && <p className="text-xs text-steel mt-1">Hides the project without deleting any data.</p>}
        </div>
      </div>
    </details>
  );
}
