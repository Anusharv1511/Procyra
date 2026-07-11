// SPC statistics — control chart constants, limits, Western Electric rules,
// and process capability. Pure functions, unit-testable, shared by the rules
// engine and the chart APIs.

// Standard control chart constants by subgroup size n (Montgomery, Intro to SQC).
const CONSTS: Record<number, { A2: number; D3: number; D4: number; d2: number }> = {
  2: { A2: 1.88, D3: 0, D4: 3.267, d2: 1.128 },
  3: { A2: 1.023, D3: 0, D4: 2.574, d2: 1.693 },
  4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
  5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 },
  6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 },
  7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 },
  9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.97 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
};

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
export const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

export type Limits = {
  center: number; ucl: number; lcl: number;   // X̄ (or individuals) chart
  rBar: number; rUcl: number; rLcl: number;   // R (or MR) chart
  sigmaWithin: number;                         // R̄/d2 (or MR̄/1.128)
};

/** X̄-R limits from subgroup means/ranges. n = subgroup size (2–10). */
export function xbarRLimits(means: number[], ranges: number[], n: number): Limits {
  const c = CONSTS[Math.min(Math.max(n, 2), 10)];
  const xbb = mean(means);
  const rBar = mean(ranges);
  return {
    center: xbb, ucl: xbb + c.A2 * rBar, lcl: xbb - c.A2 * rBar,
    rBar, rUcl: c.D4 * rBar, rLcl: c.D3 * rBar,
    sigmaWithin: rBar / c.d2,
  };
}

/** I-MR limits from individual values. */
export function imrLimits(values: number[]): Limits {
  const mrs: number[] = [];
  for (let i = 1; i < values.length; i++) mrs.push(Math.abs(values[i] - values[i - 1]));
  const mrBar = mrs.length ? mean(mrs) : 0;
  const xb = mean(values);
  const sigma = mrBar / 1.128; // d2 for n=2
  return {
    center: xb, ucl: xb + 3 * sigma, lcl: xb - 3 * sigma,
    rBar: mrBar, rUcl: 3.267 * mrBar, rLcl: 0,
    sigmaWithin: sigma,
  };
}

export type WEFlag = { rule: string; message: string };

/**
 * Western Electric rules evaluated for the LAST point of `series`
 * against center/sigma zones. Returns every rule the last point violates.
 *  WE1: 1 point beyond 3σ
 *  WE2: 2 of 3 consecutive beyond 2σ, same side
 *  WE3: 4 of 5 consecutive beyond 1σ, same side
 *  WE4: 8 consecutive on the same side of center
 */
export function westernElectric(series: number[], center: number, sigma: number): WEFlag[] {
  const flags: WEFlag[] = [];
  const i = series.length - 1;
  if (i < 0 || sigma <= 0) return flags;
  const z = (v: number) => (v - center) / sigma;
  const last = z(series[i]);

  if (Math.abs(last) > 3)
    flags.push({ rule: "WE1", message: "Point beyond 3σ control limit" });

  const side = Math.sign(last);
  if (side !== 0) {
    const lastK = (k: number) => series.slice(Math.max(0, i - k + 1), i + 1).map(z);
    const w3 = lastK(3);
    if (w3.length === 3 && w3.filter(v => Math.sign(v) === side && Math.abs(v) > 2).length >= 2 && Math.abs(last) > 2)
      flags.push({ rule: "WE2", message: "2 of 3 consecutive points beyond 2σ (same side)" });
    const w5 = lastK(5);
    if (w5.length === 5 && w5.filter(v => Math.sign(v) === side && Math.abs(v) > 1).length >= 4 && Math.abs(last) > 1)
      flags.push({ rule: "WE3", message: "4 of 5 consecutive points beyond 1σ (same side)" });
    const w8 = lastK(8);
    if (w8.length === 8 && w8.every(v => Math.sign(v) === side))
      flags.push({ rule: "WE4", message: "8 consecutive points on one side of center line" });
  }
  return flags;
}

export type Capability = {
  n: number; mean: number; sigmaWithin: number; sigmaOverall: number;
  cp: number | null; cpk: number | null; pp: number | null; ppk: number | null;
};

/**
 * Cp/Cpk use within-subgroup sigma (R̄/d2 or MR̄/1.128); Pp/Ppk use overall
 * sample standard deviation. Indices are null when the relevant spec limit
 * is missing (one-sided specs yield only the one-sided k index).
 */
export function capability(
  all: number[], sigmaWithin: number, specLow: number | null, specHigh: number | null
): Capability {
  const m = mean(all);
  const sOverall = stdev(all);
  const two = specLow != null && specHigh != null;
  const cp = two && sigmaWithin > 0 ? (specHigh! - specLow!) / (6 * sigmaWithin) : null;
  const pp = two && sOverall > 0 ? (specHigh! - specLow!) / (6 * sOverall) : null;
  const k = (s: number) => {
    if (s <= 0) return null;
    const hi = specHigh != null ? (specHigh - m) / (3 * s) : null;
    const lo = specLow != null ? (m - specLow) / (3 * s) : null;
    if (hi != null && lo != null) return Math.min(hi, lo);
    return hi ?? lo;
  };
  return { n: all.length, mean: m, sigmaWithin, sigmaOverall: sOverall, cp, cpk: k(sigmaWithin), pp, ppk: k(sOverall) };
}

/** OEE from a daily log entry. All times in same unit; counts in pieces. */
export function oee(input: { planned: number; runtime: number; idealCycle: number; total: number; good: number }) {
  const availability = input.planned > 0 ? input.runtime / input.planned : 0;
  const performance = input.runtime > 0 ? (input.idealCycle * input.total) / input.runtime : 0;
  const quality = input.total > 0 ? input.good / input.total : 0;
  return {
    availability, performance, quality,
    oee: availability * performance * quality,
  };
}
