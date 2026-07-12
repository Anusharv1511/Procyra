"use client";

// Part E (and general) — small multi-series trend line used by the SMED
// changeover history (total / internal / external minutes per changeover).

import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export default function TrendLine({ data, series, unit, height = 240 }: {
  data: Record<string, any>[];
  series: { key: string; label: string; color: string }[];
  unit?: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 12, bottom: 5, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} width={44} />
        <Tooltip formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}${unit ? " " + unit : ""}`, name]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map(s => (
          <Line key={s.key} type="linear" dataKey={s.key} name={s.label}
            stroke={s.color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
