// Part B2/B3 — tiny CSV helpers shared by the export buttons and the import
// previews. Pure functions, safe on client and server, no dependencies.

export type CsvCell = string | number | null | undefined;

const escapeCell = (v: CsvCell) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Build a CSV string (with header row) from rows of cells. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map(r => r.map(escapeCell).join(",")).join("\r\n");
}

/**
 * Parse CSV text into rows of strings. Handles quoted fields, escaped quotes
 * (""), commas and newlines inside quotes, and CRLF/LF endings. Skips fully
 * empty lines. Deliberately small — not a streaming parser; import files here
 * are at most a few thousand rows.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(x => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== "")) rows.push(row);
  return rows;
}

/** Trigger a client-side download of the given text as a file. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  // \uFEFF BOM so Excel opens UTF-8 CSVs with correct encoding.
  const blob = new Blob(["\uFEFF" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
