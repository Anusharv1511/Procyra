// Industry Adaptation layer — one central dictionary every module reads from.
// Adding an industry here re-labels the whole app (and future modules) at once.

export type Industry =
  | "general" | "automotive" | "aerospace" | "food_beverage"
  | "pharma_med" | "electronics" | "warehouse_logistics" | "construction";

export type ProcessType = "discrete" | "batch" | "continuous" | "job_shop" | "service";

export const INDUSTRIES: { key: Industry; label: string }[] = [
  { key: "general", label: "General manufacturing" },
  { key: "automotive", label: "Automotive" },
  { key: "aerospace", label: "Aerospace & defense" },
  { key: "food_beverage", label: "Food & beverage" },
  { key: "pharma_med", label: "Pharma / medical device" },
  { key: "electronics", label: "Electronics" },
  { key: "warehouse_logistics", label: "Warehouse & logistics" },
  { key: "construction", label: "Construction" },
];

export const PROCESS_TYPES: { key: ProcessType; label: string }[] = [
  { key: "discrete", label: "Discrete assembly" },
  { key: "batch", label: "Batch production" },
  { key: "continuous", label: "Continuous process" },
  { key: "job_shop", label: "Job shop" },
  { key: "service", label: "Service / transactional" },
];

type TermSet = {
  defect: string; defects: string;
  line: string; unit: string; units: string;
  operator: string; workOrder: string;
  qualityStandard: string; // suggested audit standard
};

const BASE: TermSet = {
  defect: "Defect", defects: "Defects",
  line: "Line", unit: "Unit", units: "Units",
  operator: "Operator", workOrder: "Work order",
  qualityStandard: "ISO 9001",
};

const DICT: Record<Industry, Partial<TermSet>> = {
  general: {},
  automotive: { qualityStandard: "IATF 16949", line: "Line" },
  aerospace: { defect: "Non-conformity", defects: "Non-conformities", qualityStandard: "AS9100", workOrder: "Job card" },
  food_beverage: { defect: "Deviation", defects: "Deviations", line: "Processing line", unit: "Batch", units: "Batches" },
  pharma_med: { defect: "Deviation", defects: "Deviations", unit: "Lot", units: "Lots", qualityStandard: "ISO 13485 / 21 CFR 820", workOrder: "Batch record" },
  electronics: { line: "SMT line", unit: "Board", units: "Boards" },
  warehouse_logistics: { defect: "Error", defects: "Errors", line: "Pick line", unit: "Order", units: "Orders", operator: "Associate", qualityStandard: "ISO 9001" },
  construction: { defect: "Punch item", defects: "Punch items", line: "Crew", unit: "Task", units: "Tasks", operator: "Crew member", workOrder: "Work package" },
};

export function terms(industry: string): TermSet {
  return { ...BASE, ...(DICT[(industry as Industry)] ?? {}) };
}

// Module defaults that adapt by industry — read by module create forms.
export function defaults(industry: string) {
  const strict = industry === "aerospace" || industry === "pharma_med";
  return {
    cpkThreshold: strict ? 1.67 : 1.33,
    oeeTarget: industry === "warehouse_logistics" || industry === "construction" ? 0.75 : 0.85,
    ncRepeatThreshold: strict ? 2 : 3, // repeats within window that auto-draft a CAPA
    ncRepeatWindowDays: 30,
    rpnActionThreshold: strict ? 80 : 100,
  };
}
