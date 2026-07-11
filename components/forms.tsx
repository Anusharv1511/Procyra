"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ReactNode } from "react";

export function Submit({ children, quiet }: { children: ReactNode; quiet?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={quiet ? "btn btn-quiet" : "btn"}>
      {pending ? "Working…" : children}
    </button>
  );
}

type ActionState = { error?: string; ok?: boolean; message?: string; flagged?: boolean } | null;

/** Wraps a server action so error/success messages render inline. */
export function ActionForm({ action, children, className = "" }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="mt-2 text-sm font-medium text-alarm">{state.error}</p>}
      {state?.ok && state.message && (
        <p className={`mt-2 text-sm font-medium ${state.flagged ? "text-alarm" : "text-ok"}`}>{state.message}</p>
      )}
    </form>
  );
}
