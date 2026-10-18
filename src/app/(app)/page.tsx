import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Card, CardHead, ProgressBar, KpiTile } from "@/components/ui";
import { getCohortOverview, getIpOverview, getOverviewExtras } from "@/lib/queries";
import { getYearSummary } from "@/lib/targets";
import { currentMonthKey, monthKeyLabel, yearStartFor } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

function statusColor(pct: number): string {
  if (pct >= 80) return "var(--status-good)";
  if (pct >= 50) return "var(--status-warning)";
  return "var(--status-critical)";
}

export default async function OverviewPage() {
  const user = await requireUser();
  if (!user.isAdmin && user.ipcsIpIds.length > 0) redirect("/update-status");
  if (!user.isAdmin && user.cohortIds.length > 0) redirect("/my-brands");

  const monthKey = currentMonthKey();
  const [cohorts, ips, year, extras] = await Promise.all([
    getCohortOverview(monthKey),
    getIpOverview(monthKey),
    getYearSummary(yearStartFor(monthKey)),
    getOverviewExtras(monthKey),
  ]);
  const current = year.current;
  const pct = current && current.target ? Math.min(100, Math.round((current.achieved / current.target) * 100)) : 0;

  const needsAttention = [
    ...cohorts.map((c) => ({ label: c.code, sub: c.leaderName, pct: c.pct, href: `/matrix?cohort=${c.code}` })),
    ...ips.map((ip) => ({ label: ip.name, sub: "IP", pct: ip.pct, href: `/matrix?ip=${ip.id}` })),
  ]
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  return (
    <div>
      <PageHeader title="Overview" subtitle="Everything that's done this month, at a glance" />

      <Card className="p-6 mb-5">
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {monthKeyLabel(monthKey, "long")} · IP output vs. target
        </div>
        <div className="flex items-end gap-3 mt-2">
          <div className="text-[48px] font-extrabold tabular-nums leading-none" style={{ color: statusColor(pct) }}>
            {pct}%
          </div>
          <div className="text-[13px] pb-2" style={{ color: "var(--text-muted)" }}>
            {current ? `${current.achieved} of ${current.target} (incl. ${current.backlogIn ?? 0} backlog)` : "—"}
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar pct={pct} color={statusColor(pct)} />
        </div>
        <div className="text-[10.5px] mt-2" style={{ color: "var(--text-muted)" }}>
          Target = monthly base + any shortfall carried from earlier months. Full year-by-year breakdown is on{" "}
          <Link href="/admin?tab=targets" className="underline">
            Admin → Targets
          </Link>
          .
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Link href="/rotation">
          <KpiTile label="Weekly Rotation" value={extras.week} meta={`${extras.assignedCohortCount} of ${extras.totalCohortCount} cohorts on duty this week`} />
        </Link>
        <Link href="/festive">
          <KpiTile
            label="Festive & Non-IP"
            value={`${extras.festiveNonIpDone}/${extras.festiveNonIpTotal}`}
            meta={extras.festiveNonIpTotal ? "entries live this month" : "nothing logged this month"}
          />
        </Link>
        <Link href="/trades">
          <KpiTile label="Trade-off Log" value={extras.tradeCount} meta={`cohort trade${extras.tradeCount === 1 ? "" : "s"} this month`} />
        </Link>
      </div>

      <Card className="mb-5">
        <CardHead title="Needs attention" subtitle="The 5 lowest-completion cohorts and IPs this month" />
        <div>
          {needsAttention.map((item, i) => (
            <Link
              key={`${item.label}-${i}`}
              href={item.href}
              className="flex items-center justify-between gap-3 px-5 py-3 border-b last:border-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor(item.pct) }} />
                <div>
                  <div className="text-[12px] font-bold">{item.label}</div>
                  <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
                    {item.sub}
                  </div>
                </div>
              </div>
              <div className="text-[13px] font-extrabold tabular-nums" style={{ color: statusColor(item.pct) }}>
                {item.pct}%
              </div>
            </Link>
          ))}
          {needsAttention.length === 0 && (
            <div className="text-[11px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
              Nothing to flag yet this month.
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHead title="By cohort" subtitle="Cohort Leader = person responsible for the cohort" />
          <div>
            {cohorts.map((c) => (
              <Link
                key={c.id}
                href={`/matrix?cohort=${c.code}`}
                className="flex items-center gap-3 px-5 py-3 border-b last:border-0"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-[11px] font-bold w-7 shrink-0">{c.code}</span>
                <div className="flex-1 min-w-0">
                  <ProgressBar pct={c.pct} color={statusColor(c.pct)} />
                </div>
                <span className="text-[11px] font-bold tabular-nums w-10 text-right shrink-0">{c.pct}%</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="By IP" subtitle="Content format completion across all brands" />
          <div>
            {ips.map((ip) => (
              <Link
                key={ip.id}
                href={`/matrix?ip=${ip.id}`}
                className="flex items-center gap-3 px-5 py-3 border-b last:border-0"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-[11px] font-bold flex-1 min-w-0 truncate pr-2">{ip.name}</span>
                <div className="w-[90px] shrink-0">
                  <ProgressBar pct={ip.pct} color={statusColor(ip.pct)} />
                </div>
                <span className="text-[11px] font-bold tabular-nums w-10 text-right shrink-0">{ip.pct}%</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <Link href="/matrix" className="text-[11px] underline" style={{ color: "var(--text-muted)" }}>
          Open advanced tools (matrix, rotation, festive, trends) →
        </Link>
      </div>
    </div>
  );
}
