import { PageHeader, EmptyNote } from "@/components/ui";
import { MonthSwitcher, ParamSelect } from "@/components/Switchers";
import { BrandTargetCard } from "@/components/BrandTargetCard";
import { getMatrix } from "@/lib/queries";
import { requireAdminPage } from "@/lib/auth";
import { currentMonthKey, yearMonths, yearStartFor } from "@/lib/dates";

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; ip?: string; month?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;
  const { cohorts, ips, cellMap } = await getMatrix(monthKey);

  const visibleCohorts = params.cohort ? cohorts.filter((c) => c.code === params.cohort) : cohorts;
  const visibleIps = params.ip ? ips.filter((ip) => ip.id === params.ip) : ips;
  const months = yearMonths(yearStartFor(now));

  let totalTarget = 0;
  let totalAchieved = 0;
  let totalLive = 0;
  for (const c of cellMap.values()) {
    totalTarget += c.target;
    totalAchieved += c.achieved;
    totalLive += c.live;
  }

  return (
    <div>
      <PageHeader
        title="Brand × IP Matrix"
        subtitle="Tap a brand to set its target and update progress per IP"
        right={
          <>
            <MonthSwitcher monthKeys={months} current={monthKey} />
            <ParamSelect
              param="cohort"
              label="Cohort"
              value={params.cohort ?? ""}
              options={[{ value: "", label: "All cohorts" }, ...cohorts.map((c) => ({ value: c.code, label: `${c.code} · ${c.leaderName}` }))]}
            />
            <ParamSelect
              param="ip"
              label="IP"
              value={params.ip ?? ""}
              options={[{ value: "", label: "All IPs" }, ...ips.map((ip) => ({ value: ip.id, label: ip.name }))]}
            />
          </>
        }
      />
      <div className="text-[11px] tabular-nums mb-5" style={{ color: "var(--text-secondary)" }}>
        Month total: <b>{totalAchieved}</b> achieved / <b>{totalTarget}</b> target · <b>{totalLive}</b> live
      </div>

      {visibleCohorts.map((cohort) => {
        if (cohort.brands.length === 0) return null;
        let cohortAchieved = 0;
        let cohortTarget = 0;
        for (const brand of cohort.brands) {
          for (const ip of visibleIps) {
            const cell = cellMap.get(`${brand.id}:${ip.id}`);
            if (cell) {
              cohortAchieved += cell.achieved;
              cohortTarget += cell.target;
            }
          }
        }
        return (
          <div key={cohort.id} className="mb-6">
            <h2 className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              {cohort.code} · {cohort.leaderName}
            </h2>
            {cohort.brands.map((brand) => (
              <BrandTargetCard key={brand.id} monthKey={monthKey} brandId={brand.id} brandName={brand.name} ips={visibleIps} cellMap={cellMap} />
            ))}
            <div className="flex items-center justify-end px-5 py-2 text-[11px] font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {cohort.code} total: {cohortAchieved} / {cohortTarget}
            </div>
          </div>
        );
      })}
      {visibleCohorts.every((c) => c.brands.length === 0) && <EmptyNote>No matching brands</EmptyNote>}
    </div>
  );
}
