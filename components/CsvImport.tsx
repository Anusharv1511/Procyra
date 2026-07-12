"use client";

// Part B3 — shared CSV import flow: pick a file, preview the first 10 mapped
// rows, confirm, then submit VALID rows one at a time through the SAME server
// action the single-entry form uses — so every imported row runs the same
// rule evaluation (Western Electric, recurrence → auto-CAPA, etc.) as manual
// entry. Bad rows are skipped (not fatal) and downloadable as a CSV afterward.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv, toCsv, downloadText, type CsvCell } from "@/lib/csv";

export type ValidRow = { preview: CsvCell[]; fields: Record<string, string> };
export type InvalidRow = { line: number; raw: string[]; reason: string };
export type MapResult = { valid: ValidRow[]; invalid: InvalidRow[]; error?: string };

type ActionFn = (prev: any, fd: FormData) => Promise<{ ok?: boolean; error?: string } | null | void>;

export default function CsvImport({
  summaryLabel = "Import CSV", expectedFormat, previewHeaders, mapRows, action, baseFields,
}: {
  summaryLabel?: string;
  /** short human description of the expected columns */
  expectedFormat: string;
  previewHeaders: string[];
  mapRows: (rows: string[][]) => MapResult;
  action: ActionFn;
  baseFields: Record<string, string>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mapped, setMapped] = useState<MapResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: InvalidRow[] } | null>(null);

  const reset = () => { setMapped(null); setResult(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const onFile = async (f: File | null) => {
    setResult(null);
    if (!f) { setMapped(null); return; }
    setFileName(f.name);
    const text = await f.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setMapped({ valid: [], invalid: [], error: "The file needs a header row plus at least one data row." });
      return;
    }
    setMapped(mapRows(rows));
  };

  const runImport = async () => {
    if (!mapped || importing) return;
    setImporting(true);
    setProgress(0);
    const failed: InvalidRow[] = [];
    let imported = 0;
    // Sequential on purpose: rules like Western Electric evaluate each point
    // against the points before it, exactly as if the rows were typed in order.
    for (let i = 0; i < mapped.valid.length; i++) {
      const row = mapped.valid[i];
      const fd = new FormData();
      for (const [k, v] of Object.entries({ ...baseFields, ...row.fields })) fd.set(k, v);
      try {
        const res = await action(null, fd);
        if (res && "error" in res && res.error) {
          failed.push({ line: -1, raw: row.preview.map(c => String(c ?? "")), reason: res.error });
        } else imported++;
      } catch {
        failed.push({ line: -1, raw: row.preview.map(c => String(c ?? "")), reason: "Server rejected this row." });
      }
      setProgress(i + 1);
    }
    setImporting(false);
    setResult({ imported, skipped: [...mapped.invalid, ...failed] });
    router.refresh(); // pull the freshly-imported data into the page
  };

  const downloadSkipped = () => {
    if (!result) return;
    downloadText(
      "skipped-rows.csv",
      toCsv(["reason", ...previewHeaders], result.skipped.map(r => [r.reason, ...r.raw])),
    );
  };

  return (
    <details className="no-print">
      <summary className="text-sm text-accent font-semibold cursor-pointer">{summaryLabel}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-steel">{expectedFormat} Header matching is case-insensitive. A few bad rows won&apos;t fail the whole import — they&apos;re skipped and reported.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          aria-label="Choose CSV file"
          onChange={e => onFile(e.target.files?.[0] ?? null)}
        />

        {mapped?.error && <p className="text-sm font-medium text-alarm">{mapped.error}</p>}

        {mapped && !mapped.error && !result && (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-semibold">{fileName}</span> — {mapped.valid.length} row{mapped.valid.length === 1 ? "" : "s"} ready
              {mapped.invalid.length > 0 && <span className="text-warn font-semibold"> · {mapped.invalid.length} invalid (will be skipped)</span>}
            </p>
            {mapped.valid.length > 0 && (
              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="data">
                  <thead><tr>{previewHeaders.map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {mapped.valid.slice(0, 10).map((r, i) => (
                      <tr key={i}>{r.preview.map((c, j) => <td key={j} className="text-xs">{c == null || c === "" ? "—" : String(c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                {mapped.valid.length > 10 && (
                  <p className="text-xs text-steel px-3 py-2">…and {mapped.valid.length - 10} more row{mapped.valid.length - 10 === 1 ? "" : "s"}.</p>
                )}
              </div>
            )}
            {mapped.invalid.length > 0 && (
              <ul className="text-xs text-steel space-y-0.5">
                {mapped.invalid.slice(0, 5).map((r, i) => (
                  <li key={i}>Line {r.line}: {r.reason}</li>
                ))}
                {mapped.invalid.length > 5 && <li>…and {mapped.invalid.length - 5} more.</li>}
              </ul>
            )}
            <div className="flex gap-2 items-center flex-wrap">
              <button type="button" className="btn" disabled={mapped.valid.length === 0 || importing} onClick={runImport}>
                {importing
                  ? `Importing ${progress}/${mapped.valid.length}…`
                  : `Import ${mapped.valid.length} row${mapped.valid.length === 1 ? "" : "s"}`}
              </button>
              <button type="button" className="btn btn-quiet" disabled={importing} onClick={reset}>Cancel</button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-ok">
              Imported {result.imported} row{result.imported === 1 ? "" : "s"}.
              {result.skipped.length > 0 && (
                <span className="text-warn"> {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped (invalid data).</span>
              )}
            </p>
            <div className="flex gap-2 flex-wrap">
              {result.skipped.length > 0 && (
                <button type="button" className="btn btn-quiet" onClick={downloadSkipped}>
                  Download skipped rows as CSV
                </button>
              )}
              <button type="button" className="btn btn-quiet" onClick={reset}>Import another file</button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
