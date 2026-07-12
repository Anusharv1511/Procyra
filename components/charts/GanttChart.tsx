"use client";

// Part L — simple Gantt: horizontal stacked bars (transparent offset = ES,
// solid bar = duration), critical-path tasks in alarm red, slack shown as a
// lighter extension from EF to LF. Pure presentation — all numbers come from
// lib/cpm.ts.

import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

export type GanttRow = {
  key: string; name: string; es: number; duration: number; slack: number; critical: boolean;
};

export default function GanttChart({ rows, height }: { rows: GanttRow[]; height?: number }) {
  const data = rows.map(r => ({ ...r, offset: r.es, label: `${r.key} — ${r.name}` }));
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, rows.length * 34 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 16, bottom: 5, left: 8 }} barCategoryGap={6}>
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={150} />
        <Tooltip formatter={(v: any, name: any) => name === "offset" ? [null as any, null as any] :
          [`${v}`, name === "duration" ? "Duration" : "Slack"]}
          labelFormatter={(l: any, p: any) => {
            const r = p?.[0]?.payload;
            return r ? `${l} · ES ${r.es}, EF ${r.es + r.duration}, slack ${r.slack}${r.critical ? " · CRITICAL" : ""}` : String(l);
          }} />
        <Bar dataKey="offset" stackId="g" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="duration" stackId="g" radius={[2, 2, 2, 2]} isAnimationActive={false}>
          {data.map((r, i) => <Cell key={i} fill={r.critical ? "var(--alarm)" : "var(--accent)"} />)}
        </Bar>
        <Bar dataKey="slack" stackId="g" fill="var(--line)" radius={[0, 2, 2, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
