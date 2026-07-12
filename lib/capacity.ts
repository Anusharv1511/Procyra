// Part J — Capacity & bottlenecks. Pure functions; verified against an
// independent Python reference in scripts/verify-calcs.ts.

export type CapacityStep = { name: string; cycleTime: number; availableTime: number };

export function capacityAnalysis(steps: CapacityStep[]) {
  const rows = steps.map(s => ({
    ...s,
    capacity: s.cycleTime > 0 ? s.availableTime / s.cycleTime : 0, // units per period
  }));
  const lineCapacity = rows.length ? Math.min(...rows.map(r => r.capacity)) : 0;
  return {
    steps: rows.map(r => ({ ...r, isBottleneck: rows.length > 0 && r.capacity === lineCapacity })),
    bottleneck: rows.find(r => r.capacity === lineCapacity) ?? null,
    lineCapacity, // overall line capacity = bottleneck capacity
  };
}
