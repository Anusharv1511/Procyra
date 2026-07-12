// Part I — Audit checklist. ILLUSTRATIVE ONLY: a representative subset of
// IATF 16949-style questions for internal readiness walk-throughs. This is
// NOT a certified audit tool and does not cover the standard; treat results
// as a self-check, never as evidence of conformity.

export type AuditQuestion = { id: string; clause: string; text: string };

export const AUDIT_QUESTIONS: AuditQuestion[] = [
  { id: "q1", clause: "7.1.5", text: "Are all measurement devices used for product acceptance identified, calibrated, and traceable (calibration records available)?" },
  { id: "q2", clause: "7.1.5.1.1", text: "Have MSA studies (e.g. Gage R&R) been conducted for measurement systems referenced in the control plan?" },
  { id: "q3", clause: "8.3.5.2", text: "Does a current PFMEA exist for this process, and are high-RPN items linked to actions?" },
  { id: "q4", clause: "8.5.1.1", text: "Is there a control plan covering all special characteristics, kept consistent with the PFMEA?" },
  { id: "q5", clause: "8.5.1.2", text: "Is standardized work available at the station, in the operator's language, and actually followed?" },
  { id: "q6", clause: "8.5.1.3", text: "Are set-up verifications (first-off / last-off part checks) performed and recorded at changeover?" },
  { id: "q7", clause: "8.6.2", text: "Is layout inspection / functional verification performed per the control plan frequency?" },
  { id: "q8", clause: "8.7.1", text: "Is nonconforming product identified, segregated, and dispositioned with records?" },
  { id: "q9", clause: "9.1.1.1", text: "Are process studies (SPC / capability) conducted on special characteristics, with reaction plans when unstable or incapable?" },
  { id: "q10", clause: "10.2.3", text: "Is there a defined problem-solving process (e.g. 8D) applied to customer complaints and recurring internal defects?" },
  { id: "q11", clause: "10.2.4", text: "Are error-proofing devices verified for function at a defined frequency, with records?" },
  { id: "q12", clause: "9.2.2.3", text: "Are manufacturing process audits (including this one) performed per an internal audit programme covering all shifts?" },
];

export type AuditResponse = { result: "pass" | "fail" | "na"; note?: string };

export function auditSummary(responses: Record<string, AuditResponse>) {
  const answered = AUDIT_QUESTIONS.filter(q => responses[q.id]?.result);
  const pass = answered.filter(q => responses[q.id].result === "pass").length;
  const fail = answered.filter(q => responses[q.id].result === "fail").length;
  const na = answered.filter(q => responses[q.id].result === "na").length;
  const applicable = pass + fail;
  return {
    total: AUDIT_QUESTIONS.length, answered: answered.length, pass, fail, na,
    passRatePct: applicable > 0 ? (100 * pass) / applicable : null, // N/A excluded
    failedQuestions: AUDIT_QUESTIONS.filter(q => responses[q.id]?.result === "fail"),
  };
}
