"use client";

// Part B3 — CSV bulk import for SPC measurements. Rows are committed through
// the SAME addSpcPoint server action the manual form uses (one call per row,
// oldest first), so Western Electric rules, point flags, alerts and capability
// re-checks run for every imported point exactly as with manual entry.
//
// Accepted shapes (matching how addSpcPoint accepts subgroup data — a list of
// exactly `subgroupSize` numeric values per entry):
//  - I-MR:  date/timestamp column + one value column
//  - X̄-R:   date/timestamp column + either n separate measurement columns, or
//           a single "values" column holding n numbers separated by spaces
//           (addSpcPoint splits on commas/whitespace)

import CsvImport, { type MapResult, type ValidRow, type InvalidRow } from "@/components/CsvImport";
import { addSpcPoint } from "@/app/actions";

const DATE_HEADERS = ["date", "timestamp", "ts", "datetime", "time", "when"];

function mapRowsFor(subgroupSize: number) {
  return function mapRows(rows: string[][]): MapResult {
    const header = rows[0].map(h => h.trim().toLowerCase());
    const dateCol = header.findIndex(h => DATE_HEADERS.includes(h));
    // every non-date column is treated as a measurement column
    const valueCols = header.map((_, i) => i).filter(i => i !== dateCol);
    if (valueCols.length === 0) {
      return { valid: [], invalid: [], error: "No measurement column found — include at least one value column next to the date/timestamp column." };
    }

    const valid: ValidRow[] = [];
    const invalid: InvalidRow[] = [];
    rows.slice(1).forEach((raw, i) => {
      const line = i + 2;
      let tsIso = "";
      if (dateCol >= 0) {
        const dRaw = (raw[dateCol] ?? "").trim();
        if (!dRaw) return void invalid.push({ line, raw, reason: "Missing date/timestamp." });
        const d = new Date(dRaw);
        if (isNaN(+d)) return void invalid.push({ line, raw, reason: `Unreadable date “${dRaw}”.` });
        tsIso = d.toISOString();
      }
      // Cells may each hold one number, or one cell may hold several separated
      // by spaces — mirror addSpcPoint's own tokenizer (split on comma/space).
      const tokens = valueCols
        .flatMap(c => (raw[c] ?? "").split(/[,\s]+/))
        .map(v => v.trim()).filter(Boolean);
      if (tokens.length !== subgroupSize)
        return void invalid.push({ line, raw, reason: `Expected ${subgroupSize} measurement${subgroupSize > 1 ? "s" : ""}, found ${tokens.length}.` });
      if (tokens.some(v => isNaN(Number(v))))
        return void invalid.push({ line, raw, reason: "Measurements must be numbers." });

      valid.push({
        preview: [tsIso ? new Date(tsIso).toLocaleString() : "(now)", tokens.join(", ")],
        fields: { ts: tsIso, values: tokens.join(", ") },
      });
    });
    // Oldest first — control rules evaluate each point against the ones before
    // it, so import order must match chronological order (same as manual use).
    valid.sort((a, b) => (a.fields.ts || "9999") < (b.fields.ts || "9999") ? -1 : 1);
    return { valid, invalid };
  };
}

export default function ImportSpcCsv({ projectId, streamId, subgroupSize }: {
  projectId: string; streamId: string; subgroupSize: number;
}) {
  return (
    <CsvImport
      summaryLabel="Import CSV"
      expectedFormat={`Expected columns: a date/timestamp column plus ${subgroupSize === 1
        ? "one value column (I-MR: one measurement per row)"
        : `${subgroupSize} measurement columns (or one column with ${subgroupSize} space-separated values)`}. Rows import oldest-first and each one runs the control rules on entry.`}
      previewHeaders={["Timestamp", "Values"]}
      mapRows={mapRowsFor(subgroupSize)}
      action={addSpcPoint}
      baseFields={{ projectId, streamId }}
    />
  );
}
