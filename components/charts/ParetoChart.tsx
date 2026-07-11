"use client";

// Pareto: bars pre-sorted descending SERVER-SIDE, cumulative % computed on the
// sorted order, so the cumulative line is genuinely monotonic. No smoothing.

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

export type ParetoRow = { category: string; count: number; cumPct: number };

export default function ParetoChart({ data, height = 280 }: { data: ParetoRow[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 5, left: 0 }}>
        <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} width={40}
          tickFormatter={(v: number) => `${v}%`} />
        <Tooltip formatter={(v: any, name: any) =>
          name === "Cumulative %" ? [`${Number(v).toFixed(1)}%`, name] : [v, name]} />
        <ReferenceLine yAxisId="right" y={80} stroke="var(--steel)" strokeDasharray="3 3"
          label={{ value: "80%", position: "right", fontSize: 10, fill: "var(--steel)" }} />
        <Bar yAxisId="left" dataKey="count" name="Count" fill="var(--accent)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line yAxisId="right" type="linear" dataKey="cumPct" name="Cumulative %"
          stroke="var(--alarm)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
