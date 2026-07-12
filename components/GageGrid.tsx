"use client";

// Part A — the Gage R&R measurement grid. One tab-friendly table:
// rows = parts, column groups = operators × trials. Values live in client
// state and serialize to a hidden JSON input ("grid") for saveGageData.

import { useState } from "react";

export default function GageGrid({ operators, parts, trials, initial }: {
  operators: number; parts: number; trials: number;
  initial: (number | null)[][][]; // [operator][part][trial]
}) {
  const [grid, setGrid] = useState<(string)[][][]>(
    Array.from({ length: operators }, (_, o) =>
      Array.from({ length: parts }, (_, p) =>
        Array.from({ length: trials }, (_, tr) => {
          const v = initial?.[o]?.[p]?.[tr];
          return v == null ? "" : String(v);
        }))));

  const set = (o: number, p: number, tr: number, v: string) =>
    setGrid(g => g.map((op, oi) => oi !== o ? op : op.map((pr, pi) => pi !== p ? pr : pr.map((x, ti) => ti !== tr ? x : v))));

  const asJson = JSON.stringify(grid.map(op => op.map(pr => pr.map(v => (v.trim() === "" ? null : Number(v))))));

  return (
    <div className="overflow-x-auto">
      <input type="hidden" name="grid" value={asJson} />
      <table className="data">
        <thead>
          <tr>
            <th rowSpan={2}>Part</th>
            {Array.from({ length: operators }, (_, o) => (
              <th key={o} colSpan={trials} className="text-center border-l border-line">Operator {String.fromCharCode(65 + o)}</th>
            ))}
          </tr>
          <tr>
            {Array.from({ length: operators }, (_, o) =>
              Array.from({ length: trials }, (_, tr) => (
                <th key={`${o}-${tr}`} className={tr === 0 ? "border-l border-line" : ""}>T{tr + 1}</th>
              )))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: parts }, (_, p) => (
            <tr key={p}>
              <td className="mono font-semibold">{p + 1}</td>
              {Array.from({ length: operators }, (_, o) =>
                Array.from({ length: trials }, (_, tr) => (
                  <td key={`${o}-${tr}`} className={`!p-1 ${tr === 0 ? "border-l border-line" : ""}`}>
                    <input
                      className="input mono !py-1 !px-1.5 text-sm w-20"
                      type="number" step="any" value={grid[o][p][tr]}
                      onChange={e => set(o, p, tr, e.target.value)}
                      aria-label={`Operator ${String.fromCharCode(65 + o)}, part ${p + 1}, trial ${tr + 1}`}
                      data-kbd={o === 0 && p === 0 && tr === 0 ? "new" : undefined}
                    />
                  </td>
                )))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
