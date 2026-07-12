// Part F — Acceptance sampling, ANSI/ASQ Z1.4-style single sampling plans,
// general inspection level II, NORMAL inspection.
//
// SIMPLIFICATION (deliberate, per spec): instead of embedding the full Z1.4
// master table, this reproduces its structure: the standard's Ac numbers are
// constant along diagonals of n·AQL, so a plan is resolved from x = n·AQL/100
// against the R5-series bands below. Cells that would hold a vertical arrow in
// the printed table ("use first plan below the arrow") are handled the same
// way: step to the next larger sample-size code until a numeric cell is hit.
// The result matches the printed standard for the common lot-size/AQL ranges
// covered here and is validated against known anchor plans (e.g. lot 1 000 at
// AQL 2.5 → n = 80, Ac = 5) in scripts/verify-calcs.ts. It is NOT a certified
// replacement for the standard document.

export const SUPPORTED_AQLS = [0.65, 1.0, 1.5, 2.5, 4.0];

// General inspection level II code letters by lot size.
const CODE_LETTERS: { max: number; code: string; n: number }[] = [
  { max: 8, code: "A", n: 2 }, { max: 15, code: "B", n: 3 }, { max: 25, code: "C", n: 5 },
  { max: 50, code: "D", n: 8 }, { max: 90, code: "E", n: 13 }, { max: 150, code: "F", n: 20 },
  { max: 280, code: "G", n: 32 }, { max: 500, code: "H", n: 50 }, { max: 1200, code: "J", n: 80 },
  { max: 3200, code: "K", n: 125 }, { max: 10000, code: "L", n: 200 }, { max: 35000, code: "M", n: 315 },
  { max: 150000, code: "N", n: 500 }, { max: 500000, code: "P", n: 800 }, { max: Infinity, code: "Q", n: 1250 },
];

// Ac bands over x = n·AQL/100 (R5 series ×1.585 per step). x below 0.10 or in
// (0.16, 0.40) corresponds to arrow cells in the printed master table.
function acForX(x: number): number | null {
  if (x >= 0.10 && x < 0.16) return 0;
  if (x >= 0.40 && x < 0.635) return 1;
  if (x >= 0.635 && x < 1.0) return 2;
  if (x >= 1.0 && x < 1.585) return 3;
  if (x >= 1.585 && x < 2.5) return 5;
  if (x >= 2.5 && x < 4.0) return 7;
  if (x >= 4.0 && x < 6.3) return 10;
  if (x >= 6.3 && x < 10.0) return 14;
  if (x >= 10.0) return 21; // table bottoms out at Ac = 21 for single/normal
  return null; // arrow cell — use first plan below
}

export type SamplingPlan = {
  codeLetter: string; sampleSize: number; acceptNum: number; rejectNum: number;
  note: string | null;
};

export function singleSamplingPlan(lotSize: number, aql: number): SamplingPlan | { error: string } {
  if (lotSize < 2) return { error: "Lot size must be at least 2." };
  if (!SUPPORTED_AQLS.includes(aql)) return { error: `AQL must be one of ${SUPPORTED_AQLS.join(", ")}.` };
  let idx = CODE_LETTERS.findIndex(c => lotSize <= c.max);
  const startCode = CODE_LETTERS[idx].code;
  // Arrow handling: step down to larger sample sizes until a numeric Ac cell.
  while (idx < CODE_LETTERS.length) {
    const { code, n } = CODE_LETTERS[idx];
    const ac = acForX((n * aql) / 100);
    if (ac != null) {
      const sampleSize = Math.min(n, lotSize); // n may not exceed the lot
      return {
        codeLetter: code, sampleSize, acceptNum: ac, rejectNum: ac + 1,
        note: code !== startCode
          ? `Code letter ${startCode} points to an arrow cell at this AQL — the standard directs to the first plan below (${code}).`
          : sampleSize < n ? "Sample size capped at the lot size — inspect the whole lot." : null,
      };
    }
    idx++;
  }
  return { error: "No plan available for this combination." };
}

export function samplingDecision(plan: { acceptNum: number; rejectNum?: number }, defectsFound: number) {
  const accept = defectsFound <= plan.acceptNum;
  return {
    accept,
    reasoning: accept
      ? `${defectsFound} defect${defectsFound === 1 ? "" : "s"} found ≤ acceptance number Ac = ${plan.acceptNum} → ACCEPT the lot.`
      : `${defectsFound} defects found ≥ rejection number Re = ${plan.acceptNum + 1} → REJECT the lot (screen or return it).`,
  };
}
