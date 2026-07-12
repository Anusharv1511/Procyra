"use client";

// Parts B & J — bar chart of per-station cycle times (or per-step capacities)
// with an optional dashed reference line (takt time / bottleneck capacity).
// Bars that violate the reference (over takt, or the bottleneck step) render
// in the alarm color, matching the ControlChart's semantic palette.

import {
  ComposedChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

export type StationBar = { name: string; value: number; flagged?: boolean };

export default function StationChart({ data, refValue, refLabel, unit, height = 260 }: {
  data: StationBar[]; refValue?: number; refLabel?: string; unit?: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 56, bottom: 5, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={44} />
        <YAxis tick={{ fontSize: 11 }} width={48} />
        <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}${unit ? " " + unit : ""}`, "Value"]} />
        {refValue != null && (
          <ReferenceLine y={refValue} stroke="var(--alarm)" strokeDasharray="4 3"
            label={{ value: refLabel ?? refValue.toFixed(1), position: "right", fontSize: 10, fill: "var(--alarm)" }} />
        )}
        <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.flagged ? "var(--alarm)" : "var(--accent)"} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
