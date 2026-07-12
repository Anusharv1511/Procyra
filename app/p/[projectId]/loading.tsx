// Part C — loading state for project module pages. Every page in this segment
// is force-dynamic (fresh DB reads on navigation), and previously the UI
// simply froze on the old page until data arrived. This skeleton reuses the
// existing card style; purely presentational.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6">
        <div className="h-3 w-32 rounded bg-line/70 animate-pulse" />
        <div className="h-7 w-64 rounded bg-line/70 animate-pulse mt-2" />
        <div className="zone-bands mt-2" aria-hidden><span /><span /><span /></div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4 h-64 animate-pulse" />
          <div className="card p-4 h-32 animate-pulse" />
        </div>
        <div className="card p-4 h-48 animate-pulse" />
      </div>
    </div>
  );
}
