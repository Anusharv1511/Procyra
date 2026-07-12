"use client";

// Part M — project-wide keyboard shortcuts.
//  n  → focus the page's primary "new entry" field (first [data-kbd="new"])
//  /  → focus the page's filter (first [data-kbd="filter"])
//  ?  → toggle this help overlay      Esc → close it
// Shortcuts never fire while typing in an input/textarea/select.

import { useEffect, useState } from "react";

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "Escape") { setOpen(false); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === "n") {
        const target = document.querySelector<HTMLElement>('[data-kbd="new"]');
        if (target) { e.preventDefault(); target.focus(); target.scrollIntoView({ block: "center", behavior: "smooth" }); }
      } else if (e.key === "/") {
        const target = document.querySelector<HTMLElement>('[data-kbd="filter"]');
        if (target) { e.preventDefault(); target.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)} role="dialog" aria-label="Keyboard shortcuts">
      <div className="card p-5 max-w-sm w-full anim-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm uppercase tracking-wide text-steel">Keyboard shortcuts</h2>
          <button className="text-steel hover:text-ink" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>
        <ul className="text-sm space-y-2">
          {[
            ["n", "Jump to the new-entry form on this page"],
            ["/", "Focus the filter (where one exists)"],
            ["?", "Show / hide this overlay"],
            ["Esc", "Close this overlay"],
          ].map(([k, d]) => (
            <li key={k} className="flex items-center gap-3">
              <kbd className="mono inline-flex min-w-[26px] justify-center rounded border border-line bg-paper px-1.5 py-0.5 text-xs font-semibold">{k}</kbd>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
