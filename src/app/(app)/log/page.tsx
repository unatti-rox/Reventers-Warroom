import { PageHeader, Card, CardHead, EmptyNote } from "@/components/ui";
import { LogItBrandCard } from "@/components/LogItBrandCard";
import { PieceLogControls } from "@/components/PieceLogControls";
import { getLogItCohortView, getLogItIpView, getFestivals } from "@/lib/queries";
import { currentMonthKey, monthKeyLabel } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

export default async function LogItPage() {
  const user = await requireUser();
  const monthKey = currentMonthKey();

  const showCohortView = user.isAdmin || user.cohortIds.length > 0;
  const showIpView = user.ipcsIpIds.length > 0;

  const [cohortView, ipView, festivals] = await Promise.all([
    showCohortView ? getLogItCohortView(user.isAdmin ? "all" : user.cohortIds, monthKey) : null,
    showIpView ? getLogItIpView(user.ipcsIpIds, monthKey) : [],
    showCohortView ? getFestivals() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title="Log it" subtitle={`${monthKeyLabel(monthKey, "long")} · tap once for every piece you make — everything else is computed`} />

      {!cohortView && ipView.length === 0 && <EmptyNote>Nothing to log here — this page is for cohort leaders and IP CS.</EmptyNote>}

      {cohortView &&
        cohortView.cohorts.map((cohort) => (
          <div key={cohort.id} className="mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              {cohort.code} · {cohort.leaderName}
            </h2>
            {cohort.brands.map((brand) => (
              <LogItBrandCard
                key={brand.id}
                monthKey={monthKey}
                brandId={brand.id}
                brandName={brand.name}
                ips={cohort.ips}
                cellMap={cohortView.cellMap}
                planned={brand.planned}
                festivals={festivals}
              />
            ))}
            {cohort.brands.length === 0 && (
              <div className="text-[11px] py-3" style={{ color: "var(--text-muted)" }}>
                No brands in this cohort yet.
              </div>
            )}
          </div>
        ))}

      {ipView.map(({ ip, brands }) => (
        <Card key={ip.id} className="mb-5">
          <CardHead title={ip.name} subtitle={`${brands.reduce((s, b) => s + b.achieved, 0)} achieved across ${brands.length} brands`} />
          <div>
            <div className="flex items-center gap-3 px-5 py-2 border-b text-[9px] font-bold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <span className="flex-1">Brand</span>
              <span className="text-right">Log it</span>
            </div>
            {brands.map((b) => (
              <div key={b.brandId} className="flex items-center gap-3 px-5 py-2.5 border-b last:border-0 flex-wrap" style={{ borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold truncate">{b.brandName}</div>
                  <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                    {b.cohortCode} · target {b.target}
                  </div>
                </div>
                <PieceLogControls monthKey={monthKey} brandId={b.brandId} ipId={ip.id} achieved={b.achieved} live={b.live} label={b.brandName} />
              </div>
            ))}
            {brands.length === 0 && <EmptyNote>No brands fixed to this IP yet — set that in Admin → Cohorts &amp; Brands.</EmptyNote>}
          </div>
        </Card>
      ))}
    </div>
  );
}
