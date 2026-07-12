"use client";

// Generic dynamic-rows editor used by the Phase 2 module forms (line-balance
// stations, SMED steps, capacity steps, DOE factors, CPM tasks). Rows are kept
// in client state and serialized to a hidden JSON input named `name` so the
// plain server-action form pattern used everywhere else keeps working.

import { useState } from "react";

export type RowCol =
  | { key: string; label: string; type?: "text" | "number"; placeholder?: string; width?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; width?: string };

export default function JsonRowsInput({ name, columns, addLabel = "+ Add row", initial, min = 1 }: {
  name: string; columns: RowCol[]; addLabel?: string;
  initial?: Record<string, string>[]; min?: number;
}) {
  const blank = () => Object.fromEntries(columns.map(c => [c.key, "type" in c && c.type === "select" ? (c as any).options[0].value : ""]));
  const [rows, setRows] = useState<Record<string, string>[]>(
    initial?.length ? initial : Array.from({ length: min }, blank));

  const set = (i: number, key: string, value: string) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-steel"
        style={{ gridTemplateColumns: columns.map(c => c.width ?? "1fr").join(" ") + " 28px" }}>
        {columns.map(c => <span key={c.key}>{c.label}</span>)}<span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid gap-1 items-center"
          style={{ gridTemplateColumns: columns.map(c => c.width ?? "1fr").join(" ") + " 28px" }}>
          {columns.map(c =>
            "options" in c ? (
              <select key={c.key} className="input !py-1.5 text-sm" value={row[c.key]}
                onChange={e => set(i, c.key, e.target.value)} aria-label={c.label}>
                {c.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input key={c.key} className={`input !py-1.5 text-sm ${c.type === "number" ? "mono" : ""}`}
                type={c.type === "number" ? "number" : "text"} step="any"
                value={row[c.key]} placeholder={c.placeholder}
                onChange={e => set(i, c.key, e.target.value)} aria-label={c.label}
                data-kbd={i === 0 && c === columns[0] ? "new" : undefined} />
            )
          )}
          <button type="button" aria-label="Remove row"
            className="text-steel hover:text-alarm text-lg leading-none disabled:opacity-30"
            disabled={rows.length <= min}
            onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-quiet !py-1 !px-2 text-xs" onClick={() => setRows(rs => [...rs, blank()])}>
        {addLabel}
      </button>
    </div>
  );
}
