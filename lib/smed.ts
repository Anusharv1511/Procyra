// Part E — SMED / changeover analysis. Pure functions; verified against an
// independent Python reference in scripts/verify-calcs.ts.

export type ChangeoverStep = { description: string; duration: number; kind: "internal" | "external" };

export type SmedResult = {
  total: number; internal: number; external: number;
  internalPct: number; externalPct: number;
  // The classic first SMED move: everything external should happen while the
  // machine still runs, so downtime ≈ internal time only.
  potentialDowntime: number;      // internal only — best case after separating
  savingsIfSeparated: number;     // external time currently spent stopped
  suggestion: string;
};

export function smedAnalysis(steps: ChangeoverStep[]): SmedResult {
  const internal = steps.filter(s => s.kind === "internal").reduce((a, s) => a + s.duration, 0);
  const external = steps.filter(s => s.kind === "external").reduce((a, s) => a + s.duration, 0);
  const total = internal + external;
  const internalPct = total > 0 ? (100 * internal) / total : 0;
  let suggestion: string;
  if (total === 0) suggestion = "Log the changeover's steps to analyze it.";
  else if (external > 0)
    suggestion = `${external.toFixed(1)} min of this changeover is external work (can be done while the machine runs). Move it before/after the stop and downtime drops from ${total.toFixed(1)} to ~${internal.toFixed(1)} min.`;
  else if (internalPct >= 100 && internal > 0) {
    const longest = [...steps].sort((a, b) => b.duration - a.duration)[0];
    suggestion = `All ${total.toFixed(1)} min is internal (machine stopped). Attack the longest internal step — "${longest.description}" (${longest.duration.toFixed(1)} min): pre-stage tooling, use quick-release fittings, or parallelize with a second person to convert it to external work.`;
  } else suggestion = "Changeover fully analyzed.";
  return {
    total, internal, external, internalPct, externalPct: total > 0 ? 100 - internalPct : 0,
    potentialDowntime: internal, savingsIfSeparated: external, suggestion,
  };
}
