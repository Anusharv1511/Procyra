"use client";

// Control chart with sigma zone bands (the app's signature motif made literal),
// center/UCL/LCL lines, and two distinct alarm markers (Fix 3):
//  - out of CONTROL (violates a Western Electric rule): filled red circle
//  - out of SPEC (a measurement outside LSL/USL): filled red square
// A point that is both renders as the square (spec breach is the customer-facing
// condition); the tooltip lists both.

import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea,
  ResponsiveContainer,
} from "recharts";

export type ChartPoint = { label: string; value: number; flags: string[]; outOfSpec?: boolean };

function Dot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const flagged = payload.flags?.length > 0;
  if (payload.outOfSpec) {
    // out of spec — red square
    return (
      <rect
        x={cx - 4.5} y={cy - 4.5} width={9} height={9}
        fill="var(--alarm)" stroke="#fff" strokeWidth={1}
      />
    );
  }
  return (
    <circle
      cx={cx} cy={cy} r={flagged ? 5 : 3}
      fill={flagged ? "var(--alarm)" : "var(--accent)"}
      stroke="#fff" strokeWidth={1}
    />
  );
}

export default function ControlChart({
  data, center, ucl, lcl, sigma, unit, height = 280,
}: {
  data: ChartPoint[]; center: number; ucl: number; lcl: number; sigma: number;
  unit?: string | null; height?: number;
}) {
  const pad = sigma > 0 ? sigma : Math.max(Math.abs(ucl - lcl) / 6, 1);
  const domain: [number, number] = [
    Math.min(lcl, ...data.map(d => d.value)) - pad * 0.5,
    Math.max(ucl, ...data.map(d => d.value)) + pad * 0.5,
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 56, bottom: 5, left: 0 }}>
        {/* sigma zones: C (±1σ) green, B (1–2σ) amber, A (2–3σ) red */}
        <ReferenceArea y1={center - sigma} y2={center + sigma} fill="var(--zone-c)" />
        <ReferenceArea y1={center + sigma} y2={center + 2 * sigma} fill="var(--zone-b)" />
        <ReferenceArea y1={center - 2 * sigma} y2={center - sigma} fill="var(--zone-b)" />
        <ReferenceArea y1={center + 2 * sigma} y2={ucl} fill="var(--zone-a)" />
        <ReferenceArea y1={lcl} y2={center - 2 * sigma} fill="var(--zone-a)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis domain={domain} tick={{ fontSize: 11 }} width={54}
          tickFormatter={(v: number) => v.toFixed(2)} />
        <Tooltip
          formatter={(v: any) => [`${Number(v).toFixed(3)}${unit ? " " + unit : ""}`, "Value"]}
          labelFormatter={(l: any, p: any) => {
            const pl = p?.[0]?.payload;
            const flags = pl?.flags ?? [];
            const parts: string[] = [];
            if (flags.length) parts.push(`OUT OF CONTROL (${flags.join(", ")})`);
            if (pl?.outOfSpec) parts.push("OUT OF SPEC (outside LSL/USL)");
            return parts.length ? `${l} — ${parts.join(" · ")}` : String(l);
          }}
        />
        <ReferenceLine y={ucl} stroke="var(--alarm)" strokeDasharray="4 3"
          label={{ value: `UCL ${ucl.toFixed(2)}`, position: "right", fontSize: 10, fill: "var(--alarm)" }} />
        <ReferenceLine y={center} stroke="var(--steel)"
          label={{ value: `CL ${center.toFixed(2)}`, position: "right", fontSize: 10, fill: "var(--steel)" }} />
        <ReferenceLine y={lcl} stroke="var(--alarm)" strokeDasharray="4 3"
          label={{ value: `LCL ${lcl.toFixed(2)}`, position: "right", fontSize: 10, fill: "var(--alarm)" }} />
        <Line type="linear" dataKey="value" stroke="var(--accent)" strokeWidth={1.5}
          dot={<Dot />} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
