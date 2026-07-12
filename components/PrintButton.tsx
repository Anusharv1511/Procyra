"use client";

// Part B1 — opens the browser's native print dialog, which includes
// "Save as PDF" on every modern browser. Print-specific CSS in globals.css
// hides navigation/forms/buttons so only the report content prints.

export default function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-quiet no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
