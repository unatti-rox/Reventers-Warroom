import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, CardHead } from "@/components/ui";
import { PieceLogControls } from "@/components/PieceLogControls";
import { getMyIpBrands } from "@/lib/queries";
import { currentMonthKey, currentWeekKey, monthKeyLabel } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

export default async function UpdateStatusPage() {
  const user = await requireUser();
  if (user.ipcsIpIds.length === 0) redirect("/");

  const monthKey = currentMonthKey();
  const week = currentWeekKey();
  const perIp = await getMyIpBrands(user.ipcsIpIds, monthKey);

  return (
    <div>
      <PageHeader
        title={`Hi, ${user.name}`}
        subtitle={`${monthKeyLabel(monthKey, "long")} · ${week} · showing only brands whose cohort is assigned to your IP this week`}
      />
      {perIp.map(({ ip, brands }) => {
        const totalAchieved = brands.reduce((s, b) => s + b.achieved, 0);
        return (
          <Card key={ip.id} className="mb-5">
            <CardHead title={ip.name} subtitle={`${totalAchieved} achieved across ${brands.length} brands`} />
            <div>
              <div className="flex items-center gap-3 px-5 py-2 border-b text-[9px] font-bold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <span className="flex-1">Brand</span>
                <span className="text-right">Log it</span>
              </div>
              {brands.length === 0 && (
                <div className="text-[11px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
                  No cohort is assigned to {ip.name} yet this month — set that on{" "}
                  <Link href="/rotation" className="underline">
                    Weekly Rotation
                  </Link>
                  .
                </div>
              )}
              {brands.map((b) => (
                <div
                  key={b.brandId}
                  className="flex items-center gap-3 px-5 py-2.5 border-b last:border-0 flex-wrap"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{b.brandName}</div>
                    <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                      {b.cohortCode}
                    </div>
                  </div>
                  <PieceLogControls monthKey={monthKey} brandId={b.brandId} ipId={ip.id} achieved={b.achieved} live={b.live} label={b.brandName} />
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
