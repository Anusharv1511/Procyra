"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function LearningCurve({ data, unit, height = 240 }: {
  data: { n: number; time: number }[]; unit: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 5, left: 0 }}>
        <XAxis dataKey="n" tick={{ fontSize: 11 }} label={{ value: "Unit #", position: "insideBottomRight", fontSize: 10, offset: -2 }} />
        <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v: number) => v.toFixed(2)} />
        <Tooltip formatter={(v: any) => [`${Number(v).toFixed(3)} ${unit}`, "Time per unit"]}
          labelFormatter={(l: any) => `Unit ${l}`} />
        <Line type="linear" dataKey="time" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
