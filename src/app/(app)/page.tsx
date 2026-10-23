import Link from "next/link";
import { PageHeader, Card, CardHead, ProgressBar, KpiTile, Th, Td } from "@/components/ui";
import { getCohortOverview, getIpOverview, getFestiveNonIpTotals, getMatrix } from "@/lib/queries";
import { getYearSummary } from "@/lib/targets";
import { currentMonthKey, monthKeyLabel, yearStartFor } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

function statusColor(pct: number): string {
  if (pct >= 80) return "var(--status-good)";
  if (pct >= 50) return "var(--status-warning)";
  return "var(--status-critical)";
}

/**
 * Everyone's shared visibility page: the same numbers for Ishika, IP CS, and
 * L2s alike — one dashboard, not a different view per role. Everything on
 * it is computed from the Piece log; nothing here is typed in.
 */
export default async function DashboardPage() {
  await requireUser();

  const monthKey = currentMonthKey();
  const [cohorts, ips, year, planned, matrix] = await Promise.all([
    getCohortOverview(monthKey),
    getIpOverview(monthKey),
    getYearSummary(yearStartFor(monthKey)),
    getFestiveNonIpTotals(monthKey),
    getMatrix(monthKey),
  ]);
  const current = year.current;
  const pct = current && current.target ? Math.min(100, Math.round((current.achieved / current.target) * 100)) : 0;

  const needsAttention = [
    ...cohorts.map((c) => ({ label: c.code, sub: c.leaderName, pct: c.pct })),
    ...ips.map((ip) => ({ label: ip.name, sub: "IP", pct: ip.pct })),
  ]
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Everything that's been logged this month, at a glance" />

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <KpiTile label="Festive" value={planned.festive.achieved} meta={`${planned.festive.live} live this month`} />
        <KpiTile label="Non-IP" value={planned.nonIp.achieved} meta={`${planned.nonIp.live} live this month`} />
      </div>

      <Card className="mb-5">
        <CardHead title="Needs attention" subtitle="The 5 lowest-completion cohorts and IPs this month" />
        <div>
          {needsAttention.map((item, i) => (
            <div key={`${item.label}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
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
            </div>
          ))}
          {needsAttention.length === 0 && (
            <div className="text-[11px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
              Nothing to flag yet this month.
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardHead title="By cohort" subtitle="Cohort Leader = person responsible for the cohort" />
          <div>
            {cohorts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <span className="text-[11px] font-bold w-7 shrink-0">{c.code}</span>
                <div className="flex-1 min-w-0">
                  <ProgressBar pct={c.pct} color={statusColor(c.pct)} />
                </div>
                <span className="text-[11px] font-bold tabular-nums w-10 text-right shrink-0">{c.pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="By IP" subtitle="Content format completion across all brands" />
          <div>
            {ips.map((ip) => (
              <div key={ip.id} className="flex items-center gap-3 px-5 py-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <span className="text-[11px] font-bold flex-1 min-w-0 truncate pr-2">{ip.name}</span>
                <div className="w-[90px] shrink-0">
                  <ProgressBar pct={ip.pct} color={statusColor(ip.pct)} />
                </div>
                <span className="text-[11px] font-bold tabular-nums w-10 text-right shrink-0">{ip.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Every brand × IP" subtitle="The floor-level detail behind the percentages above" />
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <Th>Brand</Th>
                <Th>IP</Th>
                <Th align="right">Target</Th>
                <Th align="right">Achieved</Th>
                <Th align="right">Live</Th>
              </tr>
            </thead>
            <tbody>
              {matrix.cohorts.flatMap((cohort) =>
                cohort.brands.flatMap((brand) =>
                  matrix.ips
                    .filter((ip) => matrix.cellMap.has(`${brand.id}:${ip.id}`))
                    .map((ip) => {
                      const cell = matrix.cellMap.get(`${brand.id}:${ip.id}`)!;
                      return (
                        <tr key={`${brand.id}:${ip.id}`}>
                          <Td className="font-bold">
                            {brand.name}
                            <div className="text-[9.5px] font-normal" style={{ color: "var(--text-muted)" }}>
                              {cohort.code} · {cohort.leaderName}
                            </div>
                          </Td>
                          <Td>{ip.name}</Td>
                          <Td align="right" className="tabular-nums">
                            {cell.target}
                          </Td>
                          <Td align="right" className="tabular-nums font-bold">
                            {cell.achieved}
                          </Td>
                          <Td align="right" className="tabular-nums">
                            {cell.live}
                          </Td>
                        </tr>
                      );
                    }),
                ),
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
