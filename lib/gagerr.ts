// Part A — Gage R&R / MSA, AIAG average-and-range method. Pure functions,
// verified against an independent Python reference implementation (see
// scripts/verify-calcs.ts run notes). EV uses the d2 constants the AIAG
// worksheet prescribes for the range of r trials (1.128 for r=2, 1.693 for
// r=3); AV and PV use d2* for a single subgroup of m values (m = number of
// operators / parts respectively), per the AIAG MSA manual.

import { mean, range } from "./spc";

// d2 for the within-part trial ranges (r = trials per part per operator).
const D2_TRIALS: Record<number, number> = { 2: 1.128, 3: 1.693 };

// d2* (g = 1 subgroup) for a single range of m values — used for AV (m =
// operators) and PV (m = parts). Duncan / AIAG MSA appendix values.
const D2_STAR: Record<number, number> = {
  2: 1.41421, 3: 1.91155, 4: 2.23887, 5: 2.48124, 6: 2.67253, 7: 2.82981,
  8: 2.96288, 9: 3.07794, 10: 3.17905, 11: 3.26909, 12: 3.35016,
  13: 3.42378, 14: 3.49116, 15: 3.55333,
};

export type GageGrid = (number | null)[][][]; // [operator][part][trial]

export type GageResult = {
  complete: boolean;          // every cell filled
  ev: number; av: number; grr: number; pv: number; tv: number;
  pctEv: number; pctAv: number; pctGrr: number; pctPv: number;
  pctTolerance: number | null; // 6·GRR / tolerance, when tolerance given
  ndc: number;
  operatorMeans: number[]; partMeans: number[];
  rBar: number; xDiff: number;
  verdict: "acceptable" | "marginal" | "unacceptable";
};

/** AIAG guidance on %GRR: <10% acceptable, 10–30% marginal, >30% unacceptable. */
export function grrVerdict(pctGrr: number): GageResult["verdict"] {
  return pctGrr < 10 ? "acceptable" : pctGrr <= 30 ? "marginal" : "unacceptable";
}

export function gageRnR(grid: GageGrid, tolerance: number | null): GageResult | { complete: false } {
  const ops = grid.length;
  const parts = grid[0]?.length ?? 0;
  const trials = grid[0]?.[0]?.length ?? 0;
  const flat = grid.flat(2);
  if (!ops || !parts || !trials || flat.some(v => v == null || isNaN(v as number)))
    return { complete: false };
  const g = grid as number[][][];

  // Per operator-part cell: average and range over trials.
  const cellMeans = g.map(op => op.map(p => mean(p)));
  const cellRanges = g.map(op => op.map(p => range(p)));
  const rBar = mean(cellRanges.flat()); // R̄̄ across all operators & parts

  const operatorMeans = cellMeans.map(row => mean(row)); // X̄ per operator
  const partMeans = Array.from({ length: parts }, (_, p) =>
    mean(g.map(op => mean(op[p]))));                     // X̄ per part
  const xDiff = range(operatorMeans);
  const rp = range(partMeans);

  // EV (repeatability) = R̄̄ / d2  — d2 = 1.128 (r=2) or 1.693 (r=3).
  const d2t = D2_TRIALS[trials] ?? 1.693;
  const ev = rBar / d2t;

  // AV (reproducibility) = sqrt( (X̄diff/d2*)² − EV²/(n·r) ), floored at 0
  // when the operator effect is smaller than the repeatability contribution.
  const d2o = D2_STAR[Math.min(Math.max(ops, 2), 15)];
  const avSq = (xDiff / d2o) ** 2 - (ev ** 2) / (parts * trials);
  const av = Math.sqrt(Math.max(avSq, 0));

  const grr = Math.sqrt(ev ** 2 + av ** 2);
  const pv = rp / D2_STAR[Math.min(Math.max(parts, 2), 15)];
  const tv = Math.sqrt(grr ** 2 + pv ** 2);

  const pct = (x: number) => (tv > 0 ? (100 * x) / tv : 0);
  const pctGrr = pct(grr);
  // %Tolerance compares the full 6σ gage spread to the spec width.
  const pctTolerance = tolerance != null && tolerance > 0 ? (100 * 6 * grr) / tolerance : null;
  const ndc = grr > 0 ? Math.floor((1.41 * pv) / grr) : 0;

  return {
    complete: true, ev, av, grr, pv, tv,
    pctEv: pct(ev), pctAv: pct(av), pctGrr, pctPv: pct(pv),
    pctTolerance, ndc, operatorMeans, partMeans, rBar, xDiff,
    verdict: grrVerdict(pctGrr),
  };
}

/** Empty [operator][part][trial] grid of nulls. */
export function emptyGrid(operators: number, parts: number, trials: number): GageGrid {
  return Array.from({ length: operators }, () =>
    Array.from({ length: parts }, () => Array.from({ length: trials }, () => null)));
}
