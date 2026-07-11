// End-to-end verification of the Phase 1 automation loop against the real DB.
// Run: npx tsx scripts/e2e.ts   (requires DATABASE_URL + AUTH_SECRET)
import { db, t } from "../db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { runSpcRules, runOeeRules, runNcRules, runFmeaRules } from "../lib/rules";

let failures = 0;
const check = (name: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
};

async function main() {
  const email = `e2e_${Date.now()}@test.local`;
  const [user] = await db.insert(t.users).values({
    email, name: "E2E Tester", passwordHash: await bcrypt.hash("test-password-123", 10),
  }).returning();
  const [ws] = await db.insert(t.workspaces).values({
    name: "E2E Plant", industry: "automotive", processType: "discrete",
  }).returning();
  await db.insert(t.memberships).values({ userId: user.id, workspaceId: ws.id });
  const [project] = await db.insert(t.projects).values({ workspaceId: ws.id, name: "E2E Project" }).returning();

  // ---- SPC: I-MR stream, stable points then a spike beyond 3σ ----
  const [spc] = await db.insert(t.streams).values({
    projectId: project.id, name: "Shaft diameter", type: "SPC_IMR",
    subgroupSize: 1, specLow: 9.9, specHigh: 10.1, cpkThreshold: 1.33, unit: "mm",
  }).returning();
  const stable = [10.00, 10.01, 9.99, 10.02, 9.98, 10.00, 10.01, 9.99, 10.00, 10.01, 9.99, 10.00];
  for (const v of stable) {
    const [p] = await db.insert(t.dataPoints).values({ streamId: spc.id, payload: { values: [v] } }).returning();
    await runSpcRules(spc.id, p.id);
  }
  const [spike] = await db.insert(t.dataPoints).values({ streamId: spc.id, payload: { values: [10.15] } }).returning();
  const flags = await runSpcRules(spc.id, spike.id);
  check("WE1 fires on a point beyond 3σ", flags.some(f => f.rule === "WE1"));
  const spcAlerts = await db.select().from(t.alerts).where(and(eq(t.alerts.streamId, spc.id), eq(t.alerts.ruleCode, "WE1")));
  check("WE1 alert row created", spcAlerts.length === 1);
  const [spikeRow] = await db.select().from(t.dataPoints).where(eq(t.dataPoints.id, spike.id));
  check("flag stored on the data point", ((spikeRow.computed as any)?.flags ?? []).some((f: any) => f.rule === "WE1"));

  // in-control point should NOT flag
  const [okPt] = await db.insert(t.dataPoints).values({ streamId: spc.id, payload: { values: [10.0] } }).returning();
  const okFlags = await runSpcRules(spc.id, okPt.id);
  check("in-control point raises no WE flags", okFlags.length === 0);

  // WE4: 8 consecutive same side on a fresh stream
  const [spc2] = await db.insert(t.streams).values({
    projectId: project.id, name: "Run test", type: "SPC_IMR", subgroupSize: 1,
  }).returning();
  const seq = [10, 10.2, 9.8, 10.1, 9.9, 10, 10.2, 9.8, 10.1, 9.9, // balanced base
    10.05, 10.06, 10.05, 10.07, 10.05, 10.06, 10.05, 10.06];        // 8 above center
  let lastFlags: any[] = [];
  for (const v of seq) {
    const [p] = await db.insert(t.dataPoints).values({ streamId: spc2.id, payload: { values: [v] } }).returning();
    lastFlags = await runSpcRules(spc2.id, p.id);
  }
  check("WE4 fires after 8 consecutive points on one side", lastFlags.some(f => f.rule === "WE4"));

  // ---- Capability alert: tight specs force Cpk below threshold ----
  const [spc3] = await db.insert(t.streams).values({
    projectId: project.id, name: "Tight spec", type: "SPC_IMR", subgroupSize: 1,
    specLow: 9.995, specHigh: 10.005, cpkThreshold: 1.33,
  }).returning();
  for (const v of stable) {
    const [p] = await db.insert(t.dataPoints).values({ streamId: spc3.id, payload: { values: [v] } }).returning();
    await runSpcRules(spc3.id, p.id);
  }
  const capAlerts = await db.select().from(t.alerts).where(and(eq(t.alerts.streamId, spc3.id), eq(t.alerts.ruleCode, "CPK_LOW")));
  check("CPK_LOW alert raised when capability below threshold", capAlerts.length >= 1);
  check("CPK_LOW alert not duplicated while open", capAlerts.length === 1);

  // ---- OEE: 3 consecutive below target ----
  const [oeeStream] = await db.insert(t.streams).values({
    projectId: project.id, name: "Line 4", type: "OEE", target: 0.85,
  }).returning();
  const badDay = { planned: 480, runtime: 400, idealCycle: 1, total: 350, good: 330 }; // OEE ≈ 0.688
  let lastOee: any = null;
  for (let i = 0; i < 3; i++) {
    const [p] = await db.insert(t.dataPoints).values({ streamId: oeeStream.id, payload: badDay }).returning();
    lastOee = await runOeeRules(oeeStream.id, p.id);
  }
  check("OEE computed correctly (A×P×Q)", Math.abs(lastOee.oee - (400/480)*(350/400)*(330/350)) < 1e-9);
  const oeeAlerts = await db.select().from(t.alerts).where(and(eq(t.alerts.streamId, oeeStream.id), eq(t.alerts.ruleCode, "OEE_BELOW_TARGET")));
  check("OEE run-below-target alert raised once", oeeAlerts.length === 1);

  // ---- NC repeat -> auto-draft CAPA (automotive threshold = 3) ----
  let autoCapa: any = null;
  for (let i = 0; i < 3; i++) {
    const [nc] = await db.insert(t.nonConformances).values({
      projectId: project.id, defectCode: "SCRATCH", processArea: "Line 4", qty: 1,
    }).returning();
    const res = await runNcRules(project.id, nc.id, "automotive");
    if (res.autoCapa) autoCapa = res.autoCapa;
  }
  check("auto-draft CAPA created after 3rd repeat", !!autoCapa);
  check("auto CAPA is a DRAFT (human confirms)", autoCapa?.status === "draft");
  const [nc4] = await db.insert(t.nonConformances).values({
    projectId: project.id, defectCode: "SCRATCH", processArea: "Line 4", qty: 1,
  }).returning();
  const res4 = await runNcRules(project.id, nc4.id, "automotive");
  check("no duplicate auto-CAPA while one is open", res4.autoCapa == null);

  // ---- FMEA: RPN recompute + threshold alert ----
  const [fmea] = await db.insert(t.fmeas).values({ projectId: project.id, name: "E2E PFMEA", rpnAction: 100 }).returning();
  const [item] = await db.insert(t.fmeaItems).values({
    fmeaId: fmea.id, processStep: "Weld", failureMode: "Cold weld",
    severity: 8, occurrence: 5, detection: 4,
  }).returning();
  const rpn = await runFmeaRules(fmea.id, item.id);
  check("RPN = S×O×D computed server-side", rpn === 160);
  const fmeaAlerts = await db.select().from(t.alerts).where(and(eq(t.alerts.sourceId, item.id), eq(t.alerts.ruleCode, "RPN_THRESHOLD")));
  check("RPN threshold alert raised", fmeaAlerts.length === 1);

  // ---- session cookie for HTTP smoke test ----
  const token = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  console.log(`COOKIE=procyra_session=${token}`);
  console.log(`PROJECT_ID=${project.id}`);
  console.log(`SPC_STREAM=${spc.id}`);
  console.log(`OEE_STREAM=${oeeStream.id}`);
  console.log(failures === 0 ? "E2E: ALL PASS" : `E2E: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
