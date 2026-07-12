"use client";

// Part A2 — public read-only share link controls, shown on Project Overview.
// The token itself is generated/revoked server-side (generateShareLink /
// revokeShareLink); this component only displays the URL and copies it.

import { useEffect, useState } from "react";
import { generateShareLink, revokeShareLink } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms";

export default function ShareLinkCard({ projectId, shareToken }: {
  projectId: string; shareToken: string | null;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = shareToken ? `${origin}/share/${shareToken}` : "";

  if (!shareToken) {
    return (
      <div>
        <p className="text-sm text-steel mb-3">
          Create a public, read-only link to this project — charts, capability, FMEA, OEE,
          CAPAs and the playbook summary, viewable without an account. No one can edit or
          log data through it, and you can revoke it at any time.
        </p>
        <ActionForm action={generateShareLink}>
          <input type="hidden" name="projectId" value={projectId} />
          <Submit>Share — create read-only link</Submit>
        </ActionForm>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          className="input mono !w-auto flex-1 min-w-[240px] !text-xs"
          readOnly
          value={url || `…/share/${shareToken}`}
          onFocus={e => e.currentTarget.select()}
          aria-label="Shareable read-only URL"
        />
        <button
          type="button"
          className="btn btn-quiet"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // clipboard unavailable (e.g. http) — the input is selectable instead
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
      <p className="text-xs text-steel">
        Anyone with this URL can <span className="font-semibold">view</span> this project —
        no login, no editing. Revoking invalidates the URL immediately; sharing again later
        creates a brand-new one.
      </p>
      <ActionForm action={revokeShareLink}>
        <input type="hidden" name="projectId" value={projectId} />
        <button
          type="submit"
          className="btn btn-quiet"
          onClick={e => {
            if (!confirm("Revoke this share link? The current URL will stop working immediately."))
              e.preventDefault();
          }}
        >
          Revoke link
        </button>
      </ActionForm>
    </div>
  );
}
