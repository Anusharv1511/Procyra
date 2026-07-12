// Part B — Line balancing math. Pure functions; verified against an
// independent Python reference in scripts/verify-calcs.ts.

export type Station = { name: string; cycleTime: number };

export type LineBalanceResult = {
  takt: number;                     // available time / required output
  bottleneck: Station | null;      // slowest station (max cycle time)
  lineCycle: number;               // = bottleneck cycle time
  totalWork: number;               // Σ station cycle times
  efficiencyPct: number;           // Σt / (n · lineCycle) · 100
  balanceDelayPct: number;         // 100 − efficiency
  theoreticalMinStations: number;  // ⌈Σt / takt⌉
  maxOutputPerPeriod: number;      // available time / lineCycle
  stations: {
    name: string; cycleTime: number;
    utilizationPct: number;        // cycle / takt · 100
    idle: number;                  // max(takt − cycle, 0)
    overTakt: boolean;             // cannot meet demand at this station
    isBottleneck: boolean;
  }[];
};

export function lineBalance(availableTime: number, requiredOutput: number, stations: Station[]): LineBalanceResult {
  const takt = requiredOutput > 0 ? availableTime / requiredOutput : 0;
  const totalWork = stations.reduce((a, s) => a + s.cycleTime, 0);
  const lineCycle = stations.length ? Math.max(...stations.map(s => s.cycleTime)) : 0;
  const bottleneck = stations.find(s => s.cycleTime === lineCycle) ?? null;
  const efficiencyPct = stations.length && lineCycle > 0
    ? (100 * totalWork) / (stations.length * lineCycle) : 0;
  return {
    takt, bottleneck, lineCycle, totalWork,
    efficiencyPct,
    balanceDelayPct: stations.length ? 100 - efficiencyPct : 0,
    theoreticalMinStations: takt > 0 ? Math.ceil(totalWork / takt - 1e-9) : 0,
    maxOutputPerPeriod: lineCycle > 0 ? availableTime / lineCycle : 0,
    stations: stations.map(s => ({
      name: s.name, cycleTime: s.cycleTime,
      utilizationPct: takt > 0 ? (100 * s.cycleTime) / takt : 0,
      idle: Math.max(takt - s.cycleTime, 0),
      overTakt: takt > 0 && s.cycleTime > takt,
      isBottleneck: s.cycleTime === lineCycle && stations.length > 0,
    })),
  };
}
