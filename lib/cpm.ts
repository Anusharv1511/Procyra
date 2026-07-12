// Part L — Critical Path Method: standard forward/backward pass over a task
// list with finish-to-start dependencies. Pure functions; verified against an
// independent Python reference in scripts/verify-calcs.ts.

export type CpmTask = { key: string; name: string; duration: number; preds: string[] };

export type CpmRow = CpmTask & {
  es: number; ef: number; ls: number; lf: number; slack: number; critical: boolean;
};

export type CpmResult =
  | { ok: true; tasks: CpmRow[]; projectDuration: number; criticalPath: string[] }
  | { ok: false; error: string };

export function cpm(tasks: CpmTask[]): CpmResult {
  if (!tasks.length) return { ok: false, error: "Add at least one task." };
  const byKey = new Map(tasks.map(t => [t.key, t]));
  for (const t of tasks) for (const p of t.preds)
    if (!byKey.has(p)) return { ok: false, error: `Task "${t.key}" depends on unknown task "${p}".` };

  // Topological sort (Kahn) — also detects dependency cycles.
  const indeg = new Map(tasks.map(t => [t.key, t.preds.length]));
  const succs = new Map<string, string[]>(tasks.map(t => [t.key, []]));
  for (const t of tasks) for (const p of t.preds) succs.get(p)!.push(t.key);
  const queue = tasks.filter(t => t.preds.length === 0).map(t => t.key);
  const order: string[] = [];
  while (queue.length) {
    const k = queue.shift()!;
    order.push(k);
    for (const s of succs.get(k)!) {
      indeg.set(s, indeg.get(s)! - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }
  if (order.length !== tasks.length)
    return { ok: false, error: "Dependency cycle detected — a task can't (directly or indirectly) depend on itself." };

  // Forward pass: ES = max(EF of predecessors), EF = ES + duration.
  const es = new Map<string, number>(), ef = new Map<string, number>();
  for (const k of order) {
    const t = byKey.get(k)!;
    const start = t.preds.length ? Math.max(...t.preds.map(p => ef.get(p)!)) : 0;
    es.set(k, start); ef.set(k, start + t.duration);
  }
  const projectDuration = Math.max(...tasks.map(t => ef.get(t.key)!));

  // Backward pass: LF = min(LS of successors) (or project end), LS = LF − duration.
  const ls = new Map<string, number>(), lf = new Map<string, number>();
  for (const k of [...order].reverse()) {
    const t = byKey.get(k)!;
    const nexts = succs.get(k)!;
    const finish = nexts.length ? Math.min(...nexts.map(s => ls.get(s)!)) : projectDuration;
    lf.set(k, finish); ls.set(k, finish - t.duration);
  }

  const rows: CpmRow[] = order.map(k => {
    const t = byKey.get(k)!;
    const slack = ls.get(k)! - es.get(k)!;
    return {
      ...t, es: es.get(k)!, ef: ef.get(k)!, ls: ls.get(k)!, lf: lf.get(k)!,
      slack, critical: Math.abs(slack) < 1e-9,
    };
  });
  return {
    ok: true, tasks: rows, projectDuration,
    criticalPath: rows.filter(r => r.critical).map(r => r.key),
  };
}
