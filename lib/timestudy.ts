// Time study math: normal time, standard time with PFD allowances, learning curve.
import { mean } from "./spc";

export function elementTimes(el: { observations: number[]; rating: number }) {
  const observed = mean(el.observations);
  const normal = observed * (el.rating / 100);
  return { observed, normal };
}

export function standardTime(normalTotal: number, personalPct: number, fatiguePct: number, delayPct: number) {
  const allowance = (personalPct + fatiguePct + delayPct) / 100;
  return normalTotal * (1 + allowance);
}

/** Wright learning curve: T_n = T_1 * n^b, b = ln(rate)/ln(2). rate as % e.g. 90. */
export function learningCurve(t1: number, ratePct: number, upTo = 32) {
  const b = Math.log(ratePct / 100) / Math.log(2);
  return Array.from({ length: upTo }, (_, i) => {
    const n = i + 1;
    return { n, time: t1 * Math.pow(n, b) };
  });
}
