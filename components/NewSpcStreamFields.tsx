"use client";

// Fix 4 — the Subgroup size field only applies to X̄-R charts, so it is shown
// only when that chart type is selected. For I-MR the server keeps forcing n=1.

import { useState } from "react";

export default function NewSpcStreamFields() {
  const [type, setType] = useState("SPC_XBAR_R");
  const isXbar = type === "SPC_XBAR_R";
  return (
    <>
      <div>
        <label className="label">Chart type</label>
        <select className="input" name="type" value={type} onChange={e => setType(e.target.value)}>
          <option value="SPC_XBAR_R">X̄-R (subgrouped)</option>
          <option value="SPC_IMR">I-MR (individuals)</option>
        </select>
      </div>
      <div>
        <label className="label">Characteristic name</label>
        <input className="input" name="name" required placeholder="e.g. Shaft diameter" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Unit</label>
          <input className="input" name="unit" placeholder="mm" />
        </div>
        {isXbar ? (
          <div>
            <label className="label">Subgroup size</label>
            <input className="input" name="subgroupSize" type="number" min={2} max={10} defaultValue={5} />
          </div>
        ) : (
          <div>
            <label className="label text-steel">Subgroup size</label>
            <p className="text-xs text-steel pt-2">Not used — I-MR charts individual values (n = 1).</p>
          </div>
        )}
      </div>
    </>
  );
}
