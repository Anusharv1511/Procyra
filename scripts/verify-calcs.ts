// Verification of all new calculation modules against reference values
// computed by an INDEPENDENT Python implementation (separate code path,
// same published formulas), plus known published anchors (ANSI/ASQ Z1.4
// plans, Wilson EOQ). Run: npx tsx scripts/verify-calcs.ts
// Exits non-zero on any mismatch.

import { gageRnR } from "../lib/gagerr";
import { lineBalance } from "../lib/linebalance";
import { generateRuns, doeEffects } from "../lib/doe";
import { fpy, rty } from "../lib/yield";
import { smedAnalysis } from "../lib/smed";
import { singleSamplingPlan, samplingDecision } from "../lib/sampling";
import { eoqDetail, abcClassify } from "../lib/eoq";
import { cpm } from "../lib/cpm";
import { capacityAnalysis } from "../lib/capacity";
import { imrLimits, westernElectric, capability, mean } from "../lib/spc";
import { SEMI_SPC_VALUES, LOGISTICS_SPC_VALUES } from "../lib/demo-seed-extra";

let checks = 0, failures = 0;
const counts: Record<string, number> = {};
let current = "";
function section(name: string) { current = name; counts[name] = 0; }
function eq(actual: number, expected: number, label: string, tol = 1e-6) {
  checks++; counts[current]++;
  if (Math.abs(actual - expected) > tol) {
    failures++;
    console.error(`FAIL [${current}] ${label}: got ${actual}, expected ${expected}`);
  }
}
function is(cond: boolean, label: string) {
  checks++; counts[current]++;
  if (!cond) { failures++; console.error(`FAIL [${current}] ${label}`); }
}

// ---- Part A: Gage R&R (3 operators × 5 parts × 3 trials) --------------------
section("Gage R&R");
const GRID = [
  [[10.0167,9.943,9.973],[10.1668,10.2284,10.2212],[9.8471,9.7504,9.7906],[10.4436,10.4662,10.5006],[9.4432,9.4639,9.518]],
  [[10.0554,10.0165,10.0607],[10.2871,10.1908,10.2867],[9.8738,9.8308,9.8087],[10.6049,10.5304,10.5011],[9.5016,9.5917,9.5624]],
  [[9.9969,9.9876,9.9643],[10.2168,10.1454,10.1662],[9.7995,9.7742,9.8034],[10.4693,10.4845,10.4055],[9.4273,9.4347,9.4096]],
];
const g = gageRnR(GRID as any, 1.0);
if (!("ev" in g)) throw new Error("gage grid should be complete");
eq(g.ev, 0.03940145697972051, "EV");
eq(g.av, 0.04122083500369309, "AV");
eq(g.grr, 0.05702308348841244, "GRR");
eq(g.pv, 0.4054290059271443, "PV");
eq(g.tv, 0.40941948035920184, "TV");
eq(g.pctGrr, 13.927789522468144, "%GRR", 1e-9);
eq(g.pctTolerance!, 34.21385009304746, "%Tolerance");
eq(g.ndc, 10, "ndc");
is(g.verdict === "marginal", "verdict marginal at 13.9% GRR");
// Degenerate sanity: identical operators & trials → EV = AV = GRR = 0
const flat = gageRnR([[[5,5],[6,6]],[[5,5],[6,6]]] as any, null);
if ("ev" in flat) { eq(flat.ev, 0, "EV=0 zero-variation"); eq(flat.av, 0, "AV=0 zero-variation"); }

// ---- Part B: Line balancing -------------------------------------------------
section("Line balancing");
const lb = lineBalance(450, 7, [
  { name: "S1", cycleTime: 50 }, { name: "S2", cycleTime: 45 },
  { name: "S3", cycleTime: 62 }, { name: "S4", cycleTime: 38 },
]);
eq(lb.takt, 64.28571428571429, "takt");
eq(lb.totalWork, 195, "total work");
eq(lb.lineCycle, 62, "line cycle (bottleneck)");
eq(lb.efficiencyPct, 78.62903225806451, "efficiency %");
eq(lb.balanceDelayPct, 21.370967741935488, "balance delay %");
eq(lb.theoreticalMinStations, 4, "theoretical min stations");
eq(lb.maxOutputPerPeriod, 7.258064516129032, "max output");
eq(lb.stations[2].utilizationPct, 96.44444444444443, "S3 utilization", 1e-9);
is(lb.stations[2].isBottleneck && !lb.stations[0].isBottleneck, "bottleneck flag on S3");
// Over-takt flag when demand rises past the bottleneck's pace
const lb2 = lineBalance(450, 8, lb.stations.map(s => ({ name: s.name, cycleTime: s.cycleTime })));
is(lb2.stations[2].overTakt === true && lb2.stations[0].overTakt === false, "over-takt flag when takt < 62");

// ---- Part C: DOE (2^3 full factorial, y = 50 + 4A − 3B + 0.5C + 2AB) --------
section("DOE");
const runs = generateRuns(3, "full").map((levels, i) => ({
  levels, response: [50.5, 54.5, 40.5, 52.5, 51.5, 55.5, 41.5, 53.5][i],
}));
const d = doeEffects(
  [{ name: "A", low: "-", high: "+" }, { name: "B", low: "-", high: "+" }, { name: "C", low: "-", high: "+" }],
  runs, "full");
const eff = (l: string) => d.effects.find(e => e.label === l)!.effect;
eq(eff("A"), 8, "main effect A"); eq(eff("B"), -6, "main effect B"); eq(eff("C"), 1, "main effect C");
eq(eff("A × B"), 4, "interaction AB"); eq(eff("A × C"), 0, "interaction AC"); eq(eff("B × C"), 0, "interaction BC");
eq(d.grandMean, 50, "grand mean");
// Half fraction: D = ABC on every run
const half = generateRuns(4, "half");
is(half.length === 8 && half.every(r => r[3] === r[0] * r[1] * r[2]), "2^(4−1) generator D = ABC");

// ---- Part D: Yield ------------------------------------------------------------
section("Yield");
eq(fpy({ started: 200, passed: 188 }), 0.94, "FPY 200/188");
eq(rty([0.94, 0.95, 195 / 210]), 0.8292142857142857, "RTY across 3 stages");

// ---- Part E: SMED -------------------------------------------------------------
section("SMED");
const sm = smedAnalysis([
  { description: "A", duration: 12.5, kind: "internal" }, { description: "B", duration: 8, kind: "external" },
  { description: "C", duration: 20, kind: "internal" }, { description: "D", duration: 4.5, kind: "external" },
]);
eq(sm.total, 45, "total"); eq(sm.internal, 32.5, "internal"); eq(sm.external, 12.5, "external");
eq(sm.internalPct, 72.22222222222223, "internal %", 1e-9);
eq(sm.potentialDowntime, 32.5, "potential downtime after separation");

// ---- Part F: Sampling — known Z1.4 single/normal/level II anchor plans --------
section("Sampling");
const anchors = [
  { lot: 1000, aql: 2.5, n: 80, ac: 5 }, { lot: 1000, aql: 1.0, n: 80, ac: 2 },
  { lot: 150, aql: 2.5, n: 20, ac: 1 }, { lot: 5000, aql: 1.0, n: 200, ac: 5 },
  { lot: 2000, aql: 0.65, n: 125, ac: 2 }, { lot: 5000, aql: 0.65, n: 200, ac: 3 },
  { lot: 300, aql: 1.0, n: 50, ac: 1 },
];
for (const a of anchors) {
  const p = singleSamplingPlan(a.lot, a.aql);
  is(!("error" in p), `plan exists lot=${a.lot} AQL=${a.aql}`);
  if (!("error" in p)) {
    eq(p.sampleSize, a.n, `n lot=${a.lot} AQL=${a.aql}`);
    eq(p.acceptNum, a.ac, `Ac lot=${a.lot} AQL=${a.aql}`);
  }
}
const dec = samplingDecision({ acceptNum: 5 }, 5);
is(dec.accept, "5 defects with Ac=5 accepts");
is(!samplingDecision({ acceptNum: 5 }, 6).accept, "6 defects with Ac=5 rejects");

// ---- Part J: Capacity ----------------------------------------------------------
section("Capacity");
const cap = capacityAnalysis([
  { name: "P1", cycleTime: 1.2, availableTime: 480 }, { name: "P2", cycleTime: 0.9, availableTime: 480 },
  { name: "P3", cycleTime: 1.5, availableTime: 450 }, { name: "P4", cycleTime: 1.1, availableTime: 480 },
]);
eq(cap.steps[0].capacity, 400, "P1 capacity");
eq(cap.steps[1].capacity, 533.3333333333334, "P2 capacity");
eq(cap.lineCapacity, 300, "line capacity = bottleneck");
is(cap.bottleneck?.name === "P3", "bottleneck is P3");

// ---- Part K: EOQ / ABC ----------------------------------------------------------
section("EOQ / ABC");
const e = eoqDetail(1200, 50, 2.4);
eq(e.eoq, 223.60679774997897, "EOQ sqrt(2·1200·50/2.4)");
eq(e.annualOrderingCost, e.annualHoldingCost, "ordering = holding cost at EOQ", 1e-9);
const abc = abcClassify([
  { id: "1", name: "X", annualDemand: 1200, orderCost: 50, holdingCost: 2.4, unitCost: 80 },
  { id: "2", name: "Y", annualDemand: 500, orderCost: 40, holdingCost: 1.2, unitCost: 15 },
  { id: "3", name: "Z", annualDemand: 3000, orderCost: 30, holdingCost: 0.8, unitCost: 2 },
  { id: "4", name: "W", annualDemand: 100, orderCost: 60, holdingCost: 5, unitCost: 400 },
]);
is(abc.map(r => `${r.name}:${r.cls}`).join(",") === "X:A,W:B,Y:C,Z:C", "ABC classes X:A W:B Y:C Z:C");
eq(abc[1].cumPct, 90.96989966555184, "W cumulative %", 1e-9);

// ---- Part L: CPM -----------------------------------------------------------------
section("CPM");
const c = cpm([
  { key: "A", name: "A", duration: 3, preds: [] }, { key: "B", name: "B", duration: 4, preds: [] },
  { key: "C", name: "C", duration: 2, preds: ["A", "B"] }, { key: "D", name: "D", duration: 5, preds: ["C"] },
  { key: "E", name: "E", duration: 2, preds: ["B"] }, { key: "F", name: "F", duration: 1, preds: ["D", "E"] },
]);
is(c.ok, "CPM solves");
if (c.ok) {
  eq(c.projectDuration, 12, "project duration");
  const row = (k: string) => c.tasks.find(t => t.key === k)!;
  eq(row("A").es, 0, "A ES"); eq(row("A").ls, 1, "A LS"); eq(row("A").slack, 1, "A slack");
  eq(row("E").slack, 5, "E slack"); eq(row("D").es, 6, "D ES"); eq(row("D").ef, 11, "D EF");
  is(c.criticalPath.join("") === "BCDF", `critical path B-C-D-F (got ${c.criticalPath.join("-")})`);
}
const cyc = cpm([{ key: "A", name: "A", duration: 1, preds: ["B"] }, { key: "B", name: "B", duration: 1, preds: ["A"] }]);
is(!cyc.ok, "cycle detected");

// ---- Part O: demo-seed SPC series verified through the REAL lib/spc.ts --------
// Confirms the semiconductor and logistics seeds actually trigger the rule
// violations their narratives claim, using the same functions runSpcRules uses.
section("Demo seeds (rule-evaluated)");
function flagsAt(values: number[], upTo: number) {
  const series = values.slice(0, upTo + 1);
  const lim = imrLimits(series);
  return westernElectric(series, lim.center, lim.sigmaWithin).map(f => f.rule);
}
{
  const v = SEMI_SPC_VALUES;
  const finalFlags = flagsAt(v, v.length - 1);
  is(finalFlags.length > 0, `semiconductor seed: final point flags a WE rule (got ${finalFlags.join(",") || "none"})`);
  const anyEarly = Array.from({ length: 15 }, (_, i) => flagsAt(v, i)).some(f => f.length > 0);
  is(!anyEarly, "semiconductor seed: first 15 points stay in control");
  const lim = imrLimits(v);
  const capv = capability(v, lim.sigmaWithin, 119.5, 120.5);
  is(capv.cpk != null && capv.cpk < 1.67, `semiconductor seed: rolling Cpk ${capv.cpk?.toFixed(2)} drops below the strict 1.67 threshold`);
}
{
  const v = LOGISTICS_SPC_VALUES;
  const finalFlags = flagsAt(v, v.length - 1);
  is(finalFlags.length > 0, `logistics seed: final point flags a WE rule (got ${finalFlags.join(",") || "none"})`);
  const anyEarly = Array.from({ length: 12 }, (_, i) => flagsAt(v, i)).some(f => f.length > 0);
  is(!anyEarly, "logistics seed: first 12 points stay in control");
}

// ------------------------------------------------------------------------------
console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}.`);
for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v} checks`);
if (failures) process.exit(1);
console.log("All calculation modules verified against independent references.");
