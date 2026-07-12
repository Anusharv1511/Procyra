// Fix 8 — plain-language definitions for newcomers, shown via HelpTip "?" icons.
// Keep these short and non-technical; they are for people without an IE background.

export const GLOSSARY = {
  cp: "How wide the spec window is compared to the process spread, ignoring whether the process is centered. Above 1.33 is generally considered capable.",
  cpk: "How well the process fits inside spec limits, accounting for how consistent it's been recently. Above 1.33 is generally considered capable.",
  pp: "Like Cp, but using all the variation seen over the whole logged period (long-term), not just short-term consistency.",
  ppk: "How well the process fit inside spec limits over the whole period, including drifts and shifts. Usually a bit lower than Cpk.",
  rpn: "Risk Priority Number = Severity × Occurrence × Detection (each scored 1–10). Bigger means riskier; items above the action threshold need a plan.",
  availability: "The share of planned time the equipment was actually running. Lost to breakdowns and changeovers.",
  performance: "How close the actual output rate was to the ideal rate while running. Lost to slow cycles and minor stops.",
  quality: "The share of produced units that were good the first time, with no rework or scrap.",
  oee: "Overall Equipment Effectiveness = Availability × Performance × Quality — one number for how much of the planned time made good product at full speed.",
} as const;
