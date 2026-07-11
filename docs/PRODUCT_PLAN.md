# Product Plan — Working Name: **Procyra**

*An engineering operations platform that automates the repeatable 80% of Industrial, Process, and Quality Engineering work — the calculations, tracking, monitoring, and documentation — so engineers spend their time on judgment calls, not spreadsheets.*

> **Status of this document:** This is the direction-check deliverable you asked for before extensive code is written. Nothing below is built yet. Approve it, redline it, or reject pieces of it — then Phase 1 starts.

---

## 1. Positioning (kept exactly as you framed it)

This tool handles the **repeatable 80%** of the IE/PE/QE job. It does not replace engineers. Every piece of copy, documentation, and README language will hold that line. The product's job is to make the calculation-heavy, log-it-every-day, re-sort-the-register work happen automatically and visibly, so the engineer's attention goes to interpretation and decisions.

The name **Procyra** is a placeholder proposal (short, domain-neutral, .com-searchable). Trivial to change globally before launch — say the word.

---

## 2. Information Architecture

### 2.1 Why not organize by discipline

Your inventory is grouped IE / PE / QE. That's the right way to *inventory* tools, but the wrong way to *navigate* them, because real users wear multiple hats (a process engineer at a small plant runs SPC *and* FMEAs *and* OEE), and because several tools are shared across disciplines (FMEA appears twice in your own list; Pareto analysis serves quality *and* yield work). Organizing by discipline would force duplicate tools or arbitrary placement.

**Proposed navigation: organize by job-to-be-done**, with discipline available as a filter/tag:

| Section | What lives here | Source tools |
|---|---|---|
| **Dashboard** | Alert inbox, out-of-control flags, due tasks, KPI trend cards | (new — see §3) |
| **Measure & Analyze** | Time study & standard time, SPC control charts, process capability, Gage R&R/MSA, DOE, yield/scrap analysis | IE + PE + QE |
| **Monitor & Track** | OEE, non-conformance & defect Pareto, CAPA tracking, changeover/SMED | PE + QE |
| **Plan & Schedule** | Line balancing, capacity & bottleneck, labor/shift scheduling, project scheduling (Gantt/CPM), inventory (EOQ, safety stock, ABC), cost-per-unit modeling | IE |
| **Risk & Compliance** | FMEA, control plans, acceptance sampling (AQL/ANSI Z1.4), 8D, root cause (5-Why/fishbone), audit checklists | PE + QE |
| **Design & Layout** | Facility layout / SLP, value stream mapping, ergonomics (NIOSH/REBA/RULA), discrete event simulation | IE |
| **Settings** | Industry/process-type setup, terminology adaptation, project & team management | cross-cutting |

### 2.2 Data hierarchy

```
User account
 └── Workspace (a company/facility — supports future team sharing)
      └── Project (a line, product family, or improvement initiative)
           ├── Module records (an FMEA register, an SPC chart, an OEE log…)
           ├── Data Streams (time-series data feeding monitoring — see §3.1)
           ├── Scheduled Tasks (recurring reviews/audits with reminders)
           └── Alerts (auto-generated, acknowledgeable)
```

Multi-user and multi-project from day one: every record is scoped `user → workspace → project`. Phase 1 ships single-user workspaces; the schema includes a membership table so team sharing in a later phase is a feature flag, not a rebuild.

---

## 3. The platform layer (my main additions to your scope)

These four cross-cutting systems are what make this a product rather than a bundle of calculators. They're built once in Phase 1 and every later module plugs into them.

### 3.1 Data Streams
Any time-series the user logs — SPC subgroups, daily OEE, defect counts, yield — is a **Stream**: a named series with a schema, an expected logging cadence, and attached **rules**. This gives every monitoring-type module the same machinery for free: trend charts, "last logged X days ago" staleness indicators, and rule evaluation on every new data point. New modules define a stream type + rules instead of reinventing storage and alerting.

### 3.2 Rules & Alerts engine
Rules run automatically on data entry (server-side, no manual re-trigger):
- **SPC:** Western Electric rules 1–4 evaluated on every new subgroup → out-of-control alert with the violated rule named, and the point flagged on the chart.
- **Capability:** Cpk recomputed on a rolling window; alert when it drops below the project's threshold.
- **OEE:** alert when OEE falls below target N consecutive days.
- **Non-conformance:** when the same defect code + process recurs ≥ N times in a window, auto-draft a CAPA (status "Draft — auto-generated", user confirms; nothing is silently created as final).
- **FMEA:** RPN auto-computed and register auto-resorted on any S/O/D edit; alert when an item crosses the action threshold.

All alerts land in the Dashboard inbox and on the module itself. Acknowledge/resolve is tracked (that's an audit-trail feature quality people actually need).

### 3.3 Scheduler
Real recurring tasks (weekly audit, monthly Gage R&R, control-plan review) with recurrence rules, assignee, due/overdue states, and reminders. Phase 1: in-app reminders + optional browser push (fits the PWA). Email reminders are a Phase 2 add (needs a mail provider key — noted as an env var, never committed).

### 3.4 Industry Adaptation layer
Your terminology-adaptation pattern, generalized: a first-run **Setup wizard** captures industry (automotive, aerospace, food & beverage, pharma/med device, electronics, general manufacturing, logistics/services) and process type (discrete assembly, batch, continuous, job shop, service). This drives a central **terminology dictionary** (e.g., "defect" vs "deviation" vs "non-conformity"; "line" vs "cell" vs "unit") and **module defaults** (e.g., default AQL levels, default OEE targets, which audit standard is suggested — ISO 9001 / IATF 16949 / AS9100). Every module reads labels from this layer — including future ones — so universality is architectural, not per-module hand work.

> ⚠️ Small correction to your list: the automotive standard is **IATF 16949** (your doc says 16929 — assuming typo; flag me if you meant something else).

### 3.5 Guided Workflows (playbook engine) — added after review discussion

Two ways to use every part of the app:

- **Expert Mode:** direct access to any tool, no forced wizards (experienced users).
- **Guided Mode:** goal-first, DMAIC-structured playbooks (Define → Measure → Analyze → Improve → Control) for users with little or no IE/PE/QE experience. Each playbook step: explains *why* the step exists, gives concrete data-collection instructions (the novice failure point is bad data, not bad math), opens the right module pre-configured by the Industry Adaptation layer, validates inputs before advancing, and ends analysis steps at a **decision gate**.

**Decision gates (human-in-the-loop by design):** the app translates computed results into plain language, suggests realistic options with tradeoffs, then *requires* the user to record the team's actual decision before the playbook branches. The app recommends; people decide. Recorded decisions form a decision log on the project — an audit-friendly artifact in its own right.

**Phase 1 scope:** the playbook engine + one flagship playbook, **"Reduce defects in a process,"** chosen because it exercises all Phase 1 modules end to end (Define problem/metric → Measure via SPC data collection → Analyze via Pareto + capability → Improve via CAPA → Control via monitored control chart). Additional playbooks (line balancing, OEE improvement, ergonomics assessment, changeover reduction) ship with their modules in Phases 2–3. Each spreadsheet workbook gains a matching **"Start Here" workflow sheet** that mirrors the guided sequence with links into the tool sheets.

**Honesty boundary:** Guided Mode makes the repeatable 80% executable by a non-specialist with correct method and validated inputs. It does not claim a novice replaces an engineer's judgment — decision gates exist precisely so judgment stays human. All copy will keep this framing.

---

## 4. Phasing

### Phase 1 — 7 modules forming one coherent loop

The Phase 1 set is chosen so the modules *feed each other*, proving the platform layer end-to-end, and so all three disciplines are represented:

| # | Module | Discipline | Why it's Phase 1 |
|---|---|---|---|
| 1 | **SPC control charts** (X̄-R, I-MR, p, c) with Western Electric auto-flagging | PE | The flagship monitor/automate demo; exercises Streams + Rules fully |
| 2 | **Process capability** (Cp/Cpk, Pp/Ppk) | PE | Computed from the *same* SPC streams — proves data reuse, zero extra entry |
| 3 | **OEE tracking** (availability × performance × quality, gauges + trends) | PE | The classic daily-log use case; exercises staleness + threshold alerts |
| 4 | **Non-conformance & defect Pareto** | QE | Feeds the CAPA automation; Pareto is a chart-quality showcase |
| 5 | **CAPA tracking** | QE | Receives auto-drafted CAPAs from repeated NCs — the second end-to-end automation |
| 6 | **FMEA register** (auto-RPN, auto-resort, action tracking) | QE | Living-document automation; links to NC codes so risk ↔ reality connect |
| 7 | **Time study & standard time** (elements, ratings, PFD allowances, learning curve) | IE | The IE anchor; a deep calculation module proving the calc-tool template |

The narrative this enables in a demo or interview: *log a measurement → point auto-flags out of control → capability recalculates → defects logged → Pareto updates → repeated defect auto-drafts a CAPA → FMEA occurrence score linked to real defect data.* That's one connected story, not seven islands.

**Explicitly deferred from Phase 1** (and why): Line balancing and Gantt/CPM are excellent but visualization-heavy and standalone — better as Phase 2 where they get proper attention. DOE and Gage R&R involve heavier statistics (ANOVA) that deserve careful validation rather than being rushed into the foundation phase.

### Phase 2 — extend the loop + planning tools
Gage R&R (MSA), acceptance sampling (ANSI Z1.4 tables), 8D (linked to CAPA records — reuses that model), control plans (linked to FMEA — the AIAG linkage), root-cause tools (5-Why, fishbone; attached to NCs/CAPAs), line balancing (precedence diagram + efficiency), capacity & bottleneck analysis, yield/scrap analysis (reuses Streams), SMED, inventory (EOQ/safety stock/ABC), DOE (factorial designs + effects plots). Also: email reminders, team sharing inside workspaces, CSV import for streams.

### Phase 3 — the heavy visual/simulation tools
Facility layout (SLP with interactive relationship diagram), value stream mapping (drag-and-drop canvas), project scheduling (Gantt + CPM), labor/shift scheduling, ergonomics (NIOSH/REBA/RULA), cost-per-unit modeling, audit checklist builder (ISO 9001 / IATF 16949 / AS9100 templates), discrete event simulation (deliberately last: it's a product in itself; Phase 3 ships a scoped single-line queue simulation, not a general-purpose DES engine — I'll document that honestly rather than fake generality).

Phases 2–3 are documented in the repo as `docs/ROADMAP.md` with, for each module, which platform pieces it reuses (stream type? rule set? linked-record type?) so extension-not-rebuild is verifiable.

---

## 5. Technical architecture

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | **Next.js 14+ (App Router), TypeScript** | One codebase for frontend + API routes; first-class Vercel free-tier deploy; huge ecosystem |
| Database | **PostgreSQL** (Neon free tier) via **Prisma** | Real relational DB from day one (streams/alerts/links are relational); Neon's free tier needs no card; Prisma migrations keep schema history clean |
| Auth | **Auth.js** — email/password (bcrypt-hashed) + Google OAuth optional | Meets your "hashed passwords" requirement; OAuth is config, not code |
| Charts | **Recharts** + targeted custom SVG (control-chart zones, OEE gauges, Pareto dual-axis) | Recharts covers 80%; custom SVG where chart correctness matters (WE zone bands, monotonic Pareto cumulative line) |
| PWA | Web manifest + service worker: app shell + last-loaded data cached (stale-while-revalidate); **read-only offline** in Phase 1 | Honest offline story: view previously loaded data offline; offline *entry* with sync is a documented Phase 2+ item, not faked |
| Native path | Capacitor-compatible structure: API access through one typed client layer, no Node-only code in components, config documented in `docs/NATIVE_WRAPPING.md` | You handle store accounts/signing; the codebase just won't fight you |
| Hosting | **Vercel** (app) + **Neon** (DB) — both free tier, no card | Fits your near-free constraint |
| Secrets | `.env` only, `.env.example` committed, secrets never in git | Per your security basics |

### An honesty note on deployment (please read)

You asked me to "test the deployed URL yourself." Here is exactly where the line is: **I can build, run, and test the full application inside my environment** (real database, real auth, real rule engine — I'll verify all of it running). **I cannot create or log into your Vercel/Neon/GitHub accounts**, so the final "click deploy" and the live URL are necessarily yours. What I'll deliver to close that gap: a `docs/DEPLOYMENT.md` with exact click-by-click steps (Neon DB → env vars → Vercel import → migration command), plus a post-deploy smoke-test checklist you run against the live URL (register, log SPC point, see the flag, install PWA). If anything on that checklist fails on your live URL, you bring me the error and I fix it. I will not claim "deployed and verified" in the README until you've run that checklist — consistent with your no-overclaiming rule.

---

## 6. Spreadsheet deliverables (parallel, not deferred)

Three workbooks in `/spreadsheets`, built alongside the corresponding web modules and covering the same Phase 1 logic first:

| Workbook | Phase 1 sheets |
|---|---|
| `IE_Toolkit.xlsx` | Guide, Setup (industry/terminology), Time Study & Standard Time (elements, ratings, PFD allowances), Learning Curve |
| `PE_Toolkit.xlsx` | Guide, Setup, SPC Data + Control Charts (X̄-R and I-MR, WE rule flags as formula columns), Process Capability, OEE Log + Trend |
| `QE_Toolkit.xlsx` | Guide, Setup, NC Log + Pareto, FMEA Register (auto-RPN, RANK-based ordering), CAPA Tracker |

Conventions, exactly per your spec: yellow fill + blue bold for inputs; black formula text, never hardcoded results; green cross-sheet links; Guide sheet with legend + reuse instructions; documented example dataset on every sheet; Setup sheet driving terminology via INDEX/MATCH.

Hard constraints I'm treating as acceptance criteria, not suggestions:
1. Pareto bars sorted descending via RANK/INDEX/MATCH onto a staging range, cumulative % computed **on the sorted range** → genuinely monotonic line.
2. No line smoothing on discrete-scenario comparisons.
3. Blank-row guards use `ISNUMBER()`, never `=""` comparisons.
4. Infeasible/blank scenarios left blank (empty-string result kept out of downstream math via ISNUMBER guards), never plotted as 0, never `NA()`; charting artifact noted in text near the chart.
5. No XLOOKUP/FILTER/SORT/UNIQUE/SEQUENCE anywhere — INDEX/MATCH, SUMIFS, SUMPRODUCT, RANK only.
6. Before delivery I'll programmatically recalculate every workbook and scan every cell for `#REF!/#N/A/#NAME?/#VALUE?` — a scripted check, not a visual one.

Phase 2/3 sheets get added to these same three workbooks as those web modules land, keeping the two products in lockstep.

---

## 7. Repository & documentation plan

```
/                     Next.js app (app/, components/, lib/, prisma/)
/spreadsheets         The three workbooks
/docs                 PRODUCT_PLAN.md (this doc), ROADMAP.md, DEPLOYMENT.md,
                      NATIVE_WRAPPING.md, DECISIONS.md (scope-change log)
README.md             Pitch (80% framing), live demo link, screenshots,
                      stack, local setup, roadmap, and the
                      "What's real vs. what's next" section you required
```

The "real vs. next" section will be a literal two-column table — genuinely functional today vs. scaffolded/planned — updated every phase. No feature will simulate a working state; unbuilt items render as clearly-labeled "coming soon" cards, not mocked screens.

---

## 8. Scope-change log (summary of deltas from your original)

1. **Added** the platform layer (§3): Data Streams, Rules & Alerts engine, Scheduler, Industry Adaptation dictionary. Reason: these four are the difference between "app" and "spreadsheet with a login page," and building them first is what makes Phases 2–3 plug-in work.
2. **Reorganized** navigation from discipline-based to job-based (§2.1). Reason: cross-hat users and shared tools; discipline kept as a filter.
3. **Merged** the two FMEA entries (yours appears under both PE root-cause and QE) into one FMEA module linked to NC data.
4. **Deferred** discrete event simulation to Phase 3 and scoped it down. Reason: a general DES engine is its own product; a fake-general one would violate your no-fake-features rule.
5. **Added** modest new items: alert acknowledge/resolve audit trail; CSV import for streams (Phase 2); staleness indicators on streams. Reason: cheap, and they're what practitioners ask for immediately.
6. **Corrected** IATF 16929 → IATF 16949 (assumed typo).
7. **Constrained** offline honestly: Phase 1 PWA = installable + read-only offline; offline data entry with sync is roadmapped, not claimed.
8. **Added (per your review feedback):** Guided Mode / DMAIC playbook engine with human-in-the-loop decision gates (§3.5), plus Expert Mode preserved for experienced users. Corrected "Dimac" → DMAIC and added the missing Define phase. Phase 1 ships the engine + one flagship playbook; more per phase.

---

## 9. What happens on your approval

1. Scaffold repo, schema, auth, workspace/project model, industry-adaptation layer.
2. Build modules in dependency order: SPC → capability → OEE → NC/Pareto → CAPA (with auto-draft rule) → FMEA → time study — each with its charts and its spreadsheet counterpart built in the same step.
3. Wire the Dashboard, Scheduler, and PWA.
4. Run the full local verification pass (app + scripted spreadsheet error scan), write all docs, hand you the deployment checklist.

Open items needing your input: **(a)** approve/adjust the Phase 1 module set, **(b)** keep or replace the name *Procyra*, **(c)** confirm IATF 16949 was a typo. Everything else I'll proceed on with the reasoning documented above.
