// Part K — Inventory: EOQ and ABC classification. Pure functions; verified
// against an independent Python reference in scripts/verify-calcs.ts.

export type Sku = { id: string; name: string; annualDemand: number; orderCost: number; holdingCost: number; unitCost: number };

/** Classic Wilson EOQ = sqrt(2·D·S / H). */
export const eoq = (annualDemand: number, orderCost: number, holdingCost: number) =>
  holdingCost > 0 ? Math.sqrt((2 * annualDemand * orderCost) / holdingCost) : 0;

/** Orders per year and total annual ordering + holding cost at the EOQ. */
export function eoqDetail(d: number, s: number, h: number) {
  const q = eoq(d, s, h);
  return {
    eoq: q,
    ordersPerYear: q > 0 ? d / q : 0,
    annualOrderingCost: q > 0 ? (d / q) * s : 0,
    annualHoldingCost: (q / 2) * h,
    totalAnnualCost: q > 0 ? (d / q) * s + (q / 2) * h : 0,
  };
}

/**
 * ABC by annual dollar volume (D × unit cost), descending, cumulative-share
 * cutoffs: A ≤ 80%, B ≤ 95%, C above. An item is classed by the cumulative
 * share INCLUDING itself, the standard convention.
 */
export function abcClassify(skus: Sku[]) {
  const rows = skus.map(s => ({ ...s, dollarVolume: s.annualDemand * s.unitCost }))
    .sort((a, b) => b.dollarVolume - a.dollarVolume);
  const total = rows.reduce((a, r) => a + r.dollarVolume, 0);
  let cum = 0;
  return rows.map(r => {
    cum += r.dollarVolume;
    const cumPct = total > 0 ? (100 * cum) / total : 0;
    return { ...r, cumPct, cls: cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C" };
  });
}
