import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { addSku, deleteSku } from "@/app/actions2";
import ParetoChart from "@/components/charts/ParetoChart";
import { getProject } from "@/lib/data";
import { eoqDetail, abcClassify } from "@/lib/eoq";
import { db, t } from "@/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) notFound();
  const skus = await db.select().from(t.skus)
    .where(eq(t.skus.projectId, project.id)).orderBy(asc(t.skus.createdAt));
  const abc = abcClassify(skus);
  const classByName = Object.fromEntries(abc.map(a => [a.name, a]));
  const pareto = abc.map(a => ({
    category: a.name, count: Number(a.dollarVolume.toFixed(0)),
    cumPct: Number(a.cumPct.toFixed(1)),
  }));
  const anyValue = abc.some(a => a.dollarVolume > 0);

  return (
    <div>
      <PageHeader eyebrow="Plan & schedule" title="Inventory — EOQ & ABC" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {skus.length === 0 ? (
            <EmptyState title="No SKUs yet"
              body="Add SKUs with annual demand and cost data. Each gets an economic order quantity (the order size that balances ordering cost against holding cost) and an ABC class from its annual value — A items deserve tight control, C items deserve cheap, simple rules."
              cta={<Link className="btn" href="#new-sku">Add SKU</Link>} />
          ) : (
            <>
              <Card title={`SKUs — ${skus.length}`}>
                <div className="overflow-x-auto">
                  <table className="data">
                    <thead><tr><th>SKU</th><th>Annual demand</th><th>EOQ</th><th>Orders/yr</th><th>Total O+H cost/yr</th><th>Annual value</th><th>Class</th><th></th></tr></thead>
                    <tbody>
                      {skus.map(sk => {
                        const d = eoqDetail(sk.annualDemand, sk.orderCost, sk.holdingCost);
                        const cls = classByName[sk.name];
                        return (
                          <tr key={sk.id}>
                            <td className="font-medium">{sk.name}</td>
                            <td className="mono">{sk.annualDemand.toLocaleString()}</td>
                            <td className="mono font-semibold">{d.eoq.toFixed(0)}</td>
                            <td className="mono">{d.ordersPerYear.toFixed(1)}</td>
                            <td className="mono">{d.totalAnnualCost.toFixed(0)}</td>
                            <td className="mono">{(sk.annualDemand * sk.unitCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td>{cls && anyValue ? <Badge tone={cls.cls === "A" ? "alarm" : cls.cls === "B" ? "warn" : "quiet"}>{cls.cls}</Badge> : "—"}</td>
                            <td>
                              <ActionForm action={deleteSku}>
                                <input type="hidden" name="projectId" value={project.id} />
                                <input type="hidden" name="id" value={sk.id} />
                                <button className="text-steel hover:text-alarm text-xs" title="Remove SKU">✕</button>
                              </ActionForm>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-steel mt-2">EOQ = √(2·D·S ÷ H). At the EOQ, annual ordering cost equals annual holding cost. Class thresholds: A ≤ 80% of cumulative annual value, B ≤ 95%, C the rest.</p>
              </Card>
              {anyValue && skus.length > 1 && (
                <Card title="ABC Pareto — annual value by SKU">
                  <ParetoChart data={pareto} />
                </Card>
              )}
            </>
          )}
        </div>
        <Card title="Add SKU" id="new-sku">
          <ActionForm action={addSku} className="space-y-3">
            <input type="hidden" name="projectId" value={project.id} />
            <div><label className="label">SKU / item</label><input className="input" name="name" required placeholder="e.g. Bearing 6204-2RS" data-kbd="new" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Annual demand (units)</label><input className="input mono" name="annualDemand" type="number" step="any" required placeholder="12000" /></div>
              <div><label className="label">Unit cost</label><input className="input mono" name="unitCost" type="number" step="any" placeholder="3.20" /></div>
              <div><label className="label">Cost per order</label><input className="input mono" name="orderCost" type="number" step="any" required placeholder="50" /></div>
              <div><label className="label">Holding cost /unit/yr</label><input className="input mono" name="holdingCost" type="number" step="any" required placeholder="0.80" /></div>
            </div>
            <Submit>Add SKU</Submit>
          </ActionForm>
          <p className="text-xs text-steel mt-3">Unit cost is only used for ABC classification (annual value = demand × unit cost); EOQ needs the other three numbers.</p>
        </Card>
      </div>
    </div>
  );
}
