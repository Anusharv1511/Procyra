"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

export type Bin = { bin: string; count: number };

// lslBin / uslBin: the label of the bin nearest each spec limit (computed
// server-side) so spec lines land on the category axis correctly.
export default function Histogram({
  bins, lslBin, uslBin, height = 260,
}: { bins: Bin[]; lslBin?: string | null; uslBin?: string | null; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bins} margin={{ top: 16, right: 30, bottom: 5, left: 0 }}>
        <XAxis dataKey="bin" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(bins.length / 8) - 1)} />
        <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" name="Count" fill="var(--accent)" isAnimationActive={false} />
        {lslBin && <ReferenceLine x={lslBin} stroke="var(--alarm)" strokeWidth={2}
          label={{ value: "LSL", position: "top", fontSize: 10, fill: "var(--alarm)" }} />}
        {uslBin && <ReferenceLine x={uslBin} stroke="var(--alarm)" strokeWidth={2}
          label={{ value: "USL", position: "top", fontSize: 10, fill: "var(--alarm)" }} />}
      </BarChart>
    </ResponsiveContainer>
  );
}
