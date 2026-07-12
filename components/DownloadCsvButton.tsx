"use client";

// Part B2 — "Download CSV" built entirely client-side from the same data the
// page already renders (passed down as serialized props). No API endpoint.

import { toCsv, downloadText, type CsvCell } from "@/lib/csv";

export default function DownloadCsvButton({ filename, headers, rows, label = "Download CSV" }: {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
  label?: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-quiet no-print"
      disabled={rows.length === 0}
      title={rows.length === 0 ? "Nothing to export yet" : undefined}
      onClick={() => downloadText(filename, toCsv(headers, rows))}
    >
      {label}
    </button>
  );
}
