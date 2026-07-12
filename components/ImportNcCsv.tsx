"use client";

// Part B3 — CSV bulk import for the defect log. Rows are committed through the
// SAME addNc server action the single-entry form uses, so recurrence detection
// and auto-CAPA drafting fire exactly as they would for manual entry.

import CsvImport, { type MapResult, type ValidRow, type InvalidRow } from "@/components/CsvImport";
import { addNc } from "@/app/actions";

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "logged", "when"],
  code: ["code", "defectcode", "defect code", "defect_code", "defect"],
  area: ["area", "processarea", "process area", "process_area"],
  qty: ["qty", "quantity", "count"],
  severity: ["severity", "sev"],
  description: ["description", "desc", "notes", "note"],
};

const SEVERITIES = ["minor", "major", "critical"];

function findCols(header: string[]) {
  const norm = header.map(h => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = norm.findIndex(h => aliases.includes(h));
    if (i >= 0) idx[key] = i;
  }
  return idx;
}

function mapRows(rows: string[][]): MapResult {
  const cols = findCols(rows[0]);
  if (cols.code == null || cols.area == null) {
    return {
      valid: [], invalid: [],
      error: "Couldn't find the required columns. The header row must include at least “code” and “area” (plus optional date, qty, severity, description).",
    };
  }
  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];
  rows.slice(1).forEach((raw, i) => {
    const line = i + 2; // 1-based, after header
    const get = (k: string) => (cols[k] != null ? (raw[cols[k]] ?? "").trim() : "");
    const code = get("code"), area = get("area");
    if (!code || !area) return void invalid.push({ line, raw, reason: "Missing code or area." });

    const dateRaw = get("date");
    let dateIso = "";
    if (dateRaw) {
      const d = new Date(dateRaw);
      if (isNaN(+d)) return void invalid.push({ line, raw, reason: `Unreadable date “${dateRaw}”.` });
      dateIso = d.toISOString();
    }

    const qtyRaw = get("qty");
    let qty = 1; // qty defaults to 1 if omitted
    if (qtyRaw) {
      qty = Number(qtyRaw);
      if (!Number.isFinite(qty) || qty < 1)
        return void invalid.push({ line, raw, reason: `Quantity “${qtyRaw}” is not a positive number.` });
    }

    const sevRaw = get("severity").toLowerCase();
    if (sevRaw && !SEVERITIES.includes(sevRaw))
      return void invalid.push({ line, raw, reason: `Severity “${get("severity")}” isn't one of minor/major/critical.` });
    const severity = sevRaw || "minor"; // severity defaults to minor if omitted

    valid.push({
      preview: [dateRaw ? new Date(dateIso).toLocaleDateString() : "(today)", code, area, qty, severity, get("description")],
      fields: {
        date: dateIso, defectCode: code, processArea: area,
        qty: String(Math.round(qty)), severity, description: get("description"),
      },
    });
  });
  // Oldest first, so the recurrence count message reads chronologically —
  // undated rows (stamped "now" server-side) go last.
  valid.sort((a, b) => (a.fields.date || "9999") < (b.fields.date || "9999") ? -1 : 1);
  return { valid, invalid };
}

export default function ImportNcCsv({ projectId }: { projectId: string }) {
  return (
    <CsvImport
      summaryLabel="Import CSV"
      expectedFormat="Expected columns: date, code, area, qty, severity, description — only code and area are required; qty defaults to 1 and severity to “minor”."
      previewHeaders={["Date", "Code", "Area", "Qty", "Severity", "Description"]}
      mapRows={mapRows}
      action={addNc}
      baseFields={{ projectId }}
    />
  );
}
