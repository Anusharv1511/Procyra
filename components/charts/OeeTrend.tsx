"use client";

import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";

export type OeeRow = { label: string; oee: number; availability: number; performance: number; quality: number };

export default function OeeTrend({ data, target, height = 280 }: { data: OeeRow[]; target: number; height?: number }) {
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 40, bottom: 5, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 11 }} width={44} />
        <Tooltip formatter={(v: any, name: any) => [`${(Number(v) * 100).toFixed(1)}%`, name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={target} stroke="var(--warn)" strokeDasharray="4 3"
          label={{ value: `Target ${pct(target)}`, position: "right", fontSize: 10, fill: "var(--warn)" }} />
        <Line type="linear" dataKey="availability" name="Availability" stroke="#7c9ccb" strokeWidth={1} dot={false} isAnimationActive={false} />
        <Line type="linear" dataKey="performance" name="Performance" stroke="#b08fc9" strokeWidth={1} dot={false} isAnimationActive={false} />
        <Line type="linear" dataKey="quality" name="Quality" stroke="#8fbf9f" strokeWidth={1} dot={false} isAnimationActive={false} />
        <Line type="linear" dataKey="oee" name="OEE" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
