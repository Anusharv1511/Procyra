// Part C — Design of Experiments: 2-level full factorial (2–4 factors) and
// the 2^(4−1) half fraction (D = ABC, resolution IV). Effects are computed
// with the standard contrast method: effect = (Σ response·sign) / (N/2).
// Verified against an independent Python reference in scripts/verify-calcs.ts.

export type DoeFactor = { name: string; low: string; high: string };
export type DoeRun = { levels: number[]; response: number | null }; // levels: −1 | +1 per factor

export type DoeEffect = { label: string; effect: number; kind: "main" | "interaction" };

/** Standard-order run matrix. full: 2^k runs. half: k=4 only, D = ABC. */
export function generateRuns(k: number, design: "full" | "half"): number[][] {
  if (design === "half" && k === 4) {
    return generateRuns(3, "full").map(r => [...r, r[0] * r[1] * r[2]]); // D = ABC
  }
  const n = 2 ** k;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: k }, (_, j) => ((i >> j) & 1) === 1 ? 1 : -1));
}

/**
 * Main effects for every factor; two-way interactions only for full-factorial
 * designs (in the 2^(4−1) half fraction two-way interactions are aliased in
 * pairs, so reporting them individually would be misleading).
 */
export function doeEffects(factors: DoeFactor[], runs: DoeRun[], design: "full" | "half"): {
  effects: DoeEffect[]; grandMean: number; complete: boolean;
} {
  const done = runs.filter(r => r.response != null && !isNaN(r.response));
  const complete = done.length === runs.length && runs.length > 0;
  if (!complete) return { effects: [], grandMean: 0, complete: false };
  const n = runs.length;
  const y = runs.map(r => r.response as number);
  const grandMean = y.reduce((a, b) => a + b, 0) / n;

  const contrast = (signs: number[]) =>
    signs.reduce((a, s, i) => a + s * y[i], 0) / (n / 2);

  const effects: DoeEffect[] = factors.map((f, j) => ({
    label: f.name, kind: "main" as const,
    effect: contrast(runs.map(r => r.levels[j])),
  }));

  if (design === "full") {
    for (let a = 0; a < factors.length; a++) {
      for (let b = a + 1; b < factors.length; b++) {
        effects.push({
          label: `${factors[a].name} × ${factors[b].name}`, kind: "interaction",
          effect: contrast(runs.map(r => r.levels[a] * r.levels[b])),
        });
      }
    }
  }
  return { effects, grandMean, complete: true };
}

/** Plain-language summary: which factor matters most, and how. */
export function doeSummary(factors: DoeFactor[], effects: DoeEffect[]): string {
  if (!effects.length) return "";
  const ranked = [...effects].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  const top = ranked[0];
  const dir = top.effect > 0 ? "raises" : "lowers";
  const mag = Math.abs(top.effect);
  if (top.kind === "main") {
    const f = factors.find(x => x.name === top.label);
    return `${top.label} matters most: moving it from ${f?.low ?? "low"} to ${f?.high ?? "high"} ${dir} the response by about ${mag.toFixed(3)} on average — roughly ${ranked[1] ? (mag / Math.max(Math.abs(ranked[1].effect), 1e-12)).toFixed(1) + "× the next largest effect" : "the only effect"}.`;
  }
  return `The interaction ${top.label} dominates (${top.effect > 0 ? "+" : ""}${top.effect.toFixed(3)}): these factors must be set together — the best level of one depends on the other, so read the run table rather than tuning factors one at a time.`;
}
