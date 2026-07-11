"use client";

// Radial OEE gauge — custom SVG, value vs target, tone follows control semantics.

export default function Gauge({ value, target, label }: { value: number; target: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  const angle = -180 + clamped * 180;
  const tone = value >= target ? "var(--ok)" : value >= target * 0.85 ? "var(--warn)" : "var(--alarm)";
  const arc = (a0: number, a1: number, r: number) => {
    const p = (a: number) => [100 + r * Math.cos((a * Math.PI) / 180), 90 + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0); const [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const tAngle = -180 + Math.max(0, Math.min(1, target)) * 180;
  const tx = 100 + 74 * Math.cos((tAngle * Math.PI) / 180);
  const ty = 90 + 74 * Math.sin((tAngle * Math.PI) / 180);
  const tx2 = 100 + 56 * Math.cos((tAngle * Math.PI) / 180);
  const ty2 = 90 + 56 * Math.sin((tAngle * Math.PI) / 180);
  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[260px]" role="img" aria-label={`${label}: ${(value * 100).toFixed(1)} percent`}>
      <path d={arc(-180, 0, 65)} fill="none" stroke="var(--line)" strokeWidth={14} strokeLinecap="round" />
      {clamped > 0.005 && (
        <path d={arc(-180, angle, 65)} fill="none" stroke={tone} strokeWidth={14} strokeLinecap="round" />
      )}
      <line x1={tx2} y1={ty2} x2={tx} y2={ty} stroke="var(--warn)" strokeWidth={2.5} />
      <text x="100" y="82" textAnchor="middle" className="mono" fontSize="26" fontWeight="700" fill={tone}>
        {(value * 100).toFixed(1)}%
      </text>
      <text x="100" y="100" textAnchor="middle" fontSize="10" fill="var(--steel)">{label} · target {(target * 100).toFixed(0)}%</text>
    </svg>
  );
}
