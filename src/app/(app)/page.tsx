import Link from "next/link";
import { PageHeader, Card, CardHead, ProgressBar, KpiTile, Th, Td } from "@/components/ui";
import { getCohortPerformance, getIpOverview, getOutputByKind } from "@/lib/queries";
import { getYearSummary } from "@/lib/targets";
import { currentMonthKey, monthKeyLabel, yearMonths, yearStartFor } from "@/lib/dates";
import { MonthSwitcher } from "@/components/Switchers";
import { requireUser } from "@/lib/auth";

function statusColor(pct: number): string {
  if (pct >= 80) return "var(--status-good)";
  if (pct >= 50) return "var(--status-warning)";
  return "var(--status-critical)";
}

/**
 * Everyone's shared visibility page: the same numbers for Ishika, IP CS, and
 * L2s alike — one dashboard, not a different view per role. Everything on
 * it is computed from the calendar; nothing here is typed in.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();

  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;
  const [performance, ips, year, byKind] = await Promise.all([
    getCohortPerformance(monthKey),
    getIpOverview(monthKey),
    getYearSummary(yearStartFor(monthKey)),
    getOutputByKind(monthKey),
  ]);
  const current = year.rows.find((r) => r.monthKey === monthKey) ?? null;
  const pct = current && current.target ? Math.min(100, Math.round((current.achieved / current.target) * 100)) : 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Everything that's been logged for the month, at a glance"
        right={<MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} />}
      />

      <Card className="p-6 mb-5">
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {monthKeyLabel(monthKey, "long")} · Total output vs. target
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
          Total output on the floor: IP + Non-IP + Festive. Target = monthly base + any shortfall carried from earlier months. Full
          year-by-year breakdown is on{" "}
          <Link href="/admin?tab=targets" className="underline">
            Admin → Targets
          </Link>
          .
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "IP", t: byKind.ip },
          { label: "Non-IP", t: byKind.nonIp },
          { label: "Festive", t: byKind.festive },
        ].map(({ label, t }) => (
          <KpiTile key={label} label={label} value={`${t.achieved} / ${t.target}`} meta={`${t.pct}% done · ${t.live} live`} />
        ))}
      </div>

      <Card className="mb-5">
        <CardHead
          title="Cohort performance"
          subtitle={`${monthKeyLabel(monthKey, "long")} · delivered / scope (scope = posts planned on Log it), by account director`}
        />
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <Th>Account director</Th>
                <Th align="right">Brands</Th>
                <Th align="right">IP</Th>
                <Th align="right">Non-IP</Th>
                <Th align="right">Festive</Th>
                <Th align="right">Delivered / Scope</Th>
                <Th align="right">%</Th>
                <Th>Progress</Th>
              </tr>
            </thead>
            <tbody>
              {performance.rows.map((r) => {
                return (
                  <tr key={r.id}>
                    <Td className="font-bold">
                      <span title={r.code}>{r.leaderName}</span>
                    </Td>
                    <Td align="right" className="tabular-nums">{r.brandCount}</Td>
                    <Td align="right" className="tabular-nums">{r.ip.achieved}/{r.ip.target}</Td>
                    <Td align="right" className="tabular-nums">{r.nonIp.achieved}/{r.nonIp.target}</Td>
                    <Td align="right" className="tabular-nums">{r.festive.achieved}/{r.festive.target}</Td>
                    <Td align="right" className="tabular-nums font-bold">{r.total.achieved}/{r.total.target}</Td>
                    <Td align="right" className="tabular-nums font-bold" style={{ color: r.total.target ? statusColor(r.total.pct) : "var(--text-muted)" }}>
                      {r.total.target ? `${r.total.pct}%` : "—"}
                    </Td>
                    <Td className="min-w-[140px]">
                      <ProgressBar pct={r.total.pct} color={statusColor(r.total.pct)} />
                    </Td>
                  </tr>
                );
              })}
              <tr style={{ background: "var(--surface-tint)" }}>
                <Td className="font-extrabold">All cohorts</Td>
                <Td align="right" className="tabular-nums font-extrabold">{performance.all.brandCount}</Td>
                <Td align="right" className="tabular-nums font-extrabold">{performance.all.ip.achieved}/{performance.all.ip.target}</Td>
                <Td align="right" className="tabular-nums font-extrabold">{performance.all.nonIp.achieved}/{performance.all.nonIp.target}</Td>
                <Td align="right" className="tabular-nums font-extrabold">{performance.all.festive.achieved}/{performance.all.festive.target}</Td>
                <Td align="right" className="tabular-nums font-extrabold">{performance.all.total.achieved}/{performance.all.total.target}</Td>
                <Td align="right" className="tabular-nums font-extrabold" style={{ color: performance.all.total.target ? statusColor(performance.all.total.pct) : "var(--text-muted)" }}>
                  {performance.all.total.target ? `${performance.all.total.pct}%` : "—"}
                </Td>
                <Td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mb-5">
        <Card>
          <CardHead title="By IP" subtitle="Content format completion across all brands" />
          <div>
            {ips.map((ip) => (
              <div key={ip.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <span className="text-[11px] font-bold flex-1 min-w-0 truncate pr-2">{ip.name}</span>
                <div className="w-[45%] shrink-0">
                  <ProgressBar pct={ip.pct} color={statusColor(ip.pct)} />
                </div>
                <span className="text-[11px] font-bold tabular-nums w-10 text-right shrink-0">{ip.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
}
