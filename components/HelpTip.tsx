"use client";

// Fix 8 — small "?" icon that shows a 1–2 sentence plain-language definition
// on hover (desktop) or tap (touch). No dependencies; closes on blur/Escape.

import { useState } from "react";

export default function HelpTip({ text, term }: { text: string; term?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        aria-label={term ? `What is ${term}?` : "What is this?"}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => e.key === "Escape" && setOpen(false)}
        className="peer ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line bg-white text-[10px] font-bold leading-none text-steel hover:border-steel hover:text-ink"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`${open ? "block" : "hidden"} peer-hover:block absolute left-1/2 top-full z-30 mt-1 w-60 -translate-x-1/2 rounded-lg border border-line bg-white p-2 text-left text-xs font-normal normal-case tracking-normal text-ink shadow-md`}
      >
        {text}
      </span>
    </span>
  );
}
