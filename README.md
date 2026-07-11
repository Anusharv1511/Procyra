# Procyra

**The repeatable 80% of Industrial, Process, and Quality Engineering work — automated.**

Procyra handles the calculations, tracking, monitoring, scheduling, and documentation that eat an engineer's week, so the engineer's time goes to judgment calls. It does not replace engineers; it replaces their busywork. Where a decision matters, the app suggests and **the team decides** — and the decision is logged.

Built with Next.js 14 (App Router) + Drizzle ORM + PostgreSQL. Installable PWA. Free-tier deployable on Vercel + Neon.

---

## What's real vs. what's next

Everything in the left column works end to end today and is covered by the automated test suite (`scripts/e2e.ts`, 14 checks). Everything in the right column is honestly labeled "coming soon" in the UI — nothing is faked.

| ✅ Working now (Phase 1) | 🔜 Roadmap (Phases 2–3) |
|---|---|
| Auth (bcrypt + signed HTTP-only session cookies), workspaces, multi-project | Team invites & roles (schema already supports memberships) |
| Industry setup wizard — terminology & thresholds adapt (8 industries) | More industries via one dictionary file (`lib/terminology.ts`) |
| SPC control charts: X̄-R and I-MR, limits from standard constants | Attribute charts (p, np, c, u), CUSUM/EWMA |
| **Western Electric rules 1–4 evaluated automatically on every entry** — flags + alerts, no manual re-check | Custom rule sets per stream |
| Process capability (Cp/Cpk/Pp/Ppk) computed live from SPC data; **Cpk-drop alerts** | Non-normal capability, tolerance intervals |
| OEE logging with A×P×Q, gauge, trend; **run-below-target alerts** | Downtime reason codes, TEEP |
| Defect/NC log with **always-sorted Pareto** (monotonic cumulative %) | CSV import, defect photos |
| **Auto-drafted CAPA when a defect repeats past your industry threshold** (draft — human confirms) | 8D reports, effectiveness checks |
| CAPA register with status workflow | Email nudges on due dates |
| FMEA register: server-computed RPN, **auto-resort, threshold alerts** | AIAG-VDA AP tables, revision history |
| Time study: elements, ratings, PFD allowances → standard time + learning curve | Predetermined systems (MTM/MOST-style), crew studies |
| Scheduler: recurring tasks, auto-advance on completion, dashboard surfacing | Email/push reminders |
| **Guided Mode**: DMAIC "Reduce defects" playbook with decision gates + decision log | More playbooks (line balancing, OEE, SMED, NIOSH) |
| Alert inbox across projects (open/resolve) | Alert routing & subscriptions |
| Installable PWA; previously visited pages readable offline | Offline data **entry** with background sync |
| 3 companion Excel workbooks (IE/PE/QE), recalculation-verified, 0 formula errors | Workbook ⇄ app CSV round-trip |

Full module inventory and phase plan: [`docs/ROADMAP.md`](docs/ROADMAP.md) · Product rationale: [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md)

## The automation loop (why this isn't a form collection)

1. You log a measurement → **Western Electric rules run on entry**; violations flag the point and raise an alert.
2. Capability recalculates from the same data → Cpk below your industry threshold raises an alert (once, not spam).
3. You log defects → the Pareto stays sorted; a **repeat past threshold auto-drafts a CAPA** for your review.
4. You edit an FMEA → RPN recomputes server-side, the register re-sorts, threshold crossings alert.
5. Recurring tasks surface on the dashboard when due and advance themselves when completed.

Rules live in [`lib/rules.ts`](lib/rules.ts) and run server-side on every write — there is no "recalculate" button to forget.

## Local setup

```bash
npm install
cp .env.example .env         # set DATABASE_URL (any Postgres) and AUTH_SECRET
npx drizzle-kit migrate      # create tables
npm run dev                  # http://localhost:3000
```

Verify the automation loop against your database:

```bash
npx tsx scripts/e2e.ts       # 14 checks: WE rules, Cpk alerts, OEE runs, auto-CAPA, RPN
```

**Note:** `tsx` does not auto-load `.env` the way `next dev`/`next build` do. If you run the command above directly and get a Postgres "no user specified" error, either export the vars first or run with Node's built-in env-file support (Node 20+):

```bash
node --env-file=.env node_modules/.bin/tsx scripts/e2e.ts


Deploy (Neon + Vercel, free tier): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — includes a post-deploy smoke checklist.
Wrap as a native app later: [`docs/NATIVE_WRAPPING.md`](docs/NATIVE_WRAPPING.md).

## Companion workbooks

[`/spreadsheets`](spreadsheets/) contains three Excel workbooks mirroring the Phase 1 modules for offline/shareable use:

- **PE_Toolkit.xlsx** — SPC X̄-R + I-MR (WE1/WE4 flags), capability, OEE log
- **QE_Toolkit.xlsx** — NC log, auto-sorted Pareto, FMEA register, CAPA tracker
- **IE_Toolkit.xlsx** — time study with PFD allowances, learning curve

Conventions: yellow+blue = type here, black = formula, green = cross-sheet link; a Setup sheet adapts terminology by industry via INDEX/MATCH; only classic functions (works in old Excel and LibreOffice). All three pass automated recalculation with **zero formula errors**; generator scripts are in [`spreadsheets/src`](spreadsheets/src/). Each Guide sheet states plainly what the workbook does *not* do (e.g. Excel checks WE rules 1 & 4; the app checks all four).

## Project structure

```
app/            pages (App Router) + actions.ts (all mutations, auth-checked)
lib/            spc.ts (statistics) · rules.ts (alert engine) · terminology.ts
                playbooks.ts (guided mode) · auth.ts · timestudy.ts
db/             schema.ts (Drizzle) + migrations
components/     UI + charts (control chart with σ zones, Pareto, OEE, histogram…)
public/         PWA manifest, service worker, icons
scripts/        e2e.ts — automation-loop test suite
spreadsheets/   the three workbooks + their generator scripts
docs/           product plan, roadmap, deployment, native wrapping, decisions
```

## Honest status

- Built and tested locally against PostgreSQL 16 (all 14 e2e checks and a 12-page HTTP smoke test pass; `npm run build` clean). **Not yet deployed** — deployment is a ~15-minute checklist in `docs/DEPLOYMENT.md` requiring your own Neon/Vercel accounts.
- PWA offline scope is read-only (recently visited pages). Offline *entry* is a roadmap item, and the in-app copy says so.
- Anything not built yet appears in the UI as "coming soon" with its phase — no dead buttons pretending to work.

License: MIT.
