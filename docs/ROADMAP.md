# Procyra — Roadmap (Phases 2–3)

Phase 1 shipped a complete loop (measure → flag → analyze → act → control) plus the platform layer every later module reuses: **Data Streams**, **Rules & Alerts**, **Scheduler**, **Industry Adaptation**, and the **Guided Mode playbook engine**. Each roadmap module below names the platform pieces it plugs into — that's the point of the architecture: new modules are mostly domain logic, not plumbing.

## Phase 2 — deepen the quality/production loop

| Module | What it does | Reuses |
|---|---|---|
| Gage R&R / MSA | Crossed studies, %GRR, ndc; gate for trusting SPC data | Streams (measurement data), Alerts (%GRR over 30%) |
| Acceptance sampling | ANSI/ASQ Z1.4-style single plans, OC curve | Industry Adaptation (AQL defaults) |
| 8D reports | Structured problem solving generated from a CAPA | CAPA data, Decision log |
| Control plans | Characteristic → method → reaction plan, linked to SPC streams | Streams, FMEA items |
| RCA tools | 5-Why and fishbone builders attached to CAPAs/NCs | CAPA, NC log |
| Line balancing | Takt, precedence, station assignment, balance-delay % | Time study standard times |
| Capacity & bottlenecks | Utilization per resource, bottleneck detection | Streams (OEE), Scheduler |
| Yield / scrap tracking | FPY/RTY streams with trend alerts | Streams, Rules engine |
| SMED / changeover | Internal/external step split, changeover-time stream | Streams, Time study |
| Inventory basics | EOQ, ABC classification, reorder alerts | Rules engine, Scheduler |
| DOE (basic) | 2^k factorial design + effects plot | Streams (results), Guided Mode playbook |
| CSV import/export | Round-trip with the companion workbooks | All modules |
| Team sharing | Invites, roles on memberships (schema is ready) | Auth/memberships |
| Email reminders | Scheduler sends due-task and alert digests | Scheduler, Alerts |
| New playbooks | "Balance a line", "Improve OEE", "Cut changeover (SMED)" | Playbook engine |

## Phase 3 — plan the facility and the work

| Module | What it does | Reuses |
|---|---|---|
| Facility layout (SLP) | Relationship chart → block layout scoring | Guided Mode |
| Value stream mapping | C/T, C/O, uptime per step; lead-time ladder | OEE/Time study data |
| Gantt / CPM | Critical path, float, milestone alerts | Scheduler, Alerts |
| Labor scheduling | Shift patterns vs demand | Capacity, Scheduler |
| Ergonomics | NIOSH lifting equation, REBA checklists | Guided Mode, Alerts |
| Cost modeling | Cost of quality, scrap cost rollups | NC/Yield data |
| Audit checklists | ISO 9001 / IATF 16949 / AS9100 templates by industry | Industry Adaptation, Scheduler |
| Simulation (scoped) | Simple queueing/what-if for one line | Capacity data |
| Offline data entry | Queue writes in the service worker, sync on reconnect | PWA layer |
| Native wrapping | Capacitor iOS/Android builds (see NATIVE_WRAPPING.md) | — |

## Sequencing logic

Phase 2 items were chosen because each either (a) closes a trust gap in Phase 1 data (Gage R&R), (b) extends an existing record type (8D from CAPA, control plans from FMEA+SPC), or (c) consumes numbers Phase 1 already produces (line balancing from standard times). Phase 3 items need either richer visual tooling (layout, VSM, Gantt) or infrastructure (offline sync, email) that deserves its own focused effort.
