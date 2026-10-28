import { PageHeader, Card, CardHead, ProgressBar, KpiTile, Th, Td } from "@/components/ui";
import { getCohortPerformance, getIpOverview, getOutputByKind, SLIPPING_DAYS, type Pace } from "@/lib/queries";
import { currentMonthKey, monthKeyLabel, yearMonths, yearStartFor } from "@/lib/dates";
import { MonthSwitcher } from "@/components/Switchers";
import { requireUser } from "@/lib/auth";

function statusColor(pct: number): string {
  if (pct >= 80) return "var(--status-good)";
  if (pct >= 50) return "var(--status-warning)";
  return "var(--status-critical)";
}

const PACE_COLOR: Record<Pace, string> = {
  none: "var(--text-muted)",
  onTrack: "var(--status-good)",
  slipping: "var(--status-warning)",
  behind: "var(--status-critical)",
};

/** Green = every post past its date is live; orange = some late by up to SLIPPING_DAYS; red = later than that. Grey when nothing is planned. */
function paceOf(t: { pace: Pace; total: { target: number } }): Pace {
  return t.total.target ? t.pace : "none";
}

function paceTitle(t: { late: number; daysLate: number }): string | undefined {
  if (t.late === 0) return undefined;
  return `${t.late} post${t.late === 1 ? "" : "s"} past ${t.late === 1 ? "its" : "their"} date and not live yet (up to ${t.daysLate} day${t.daysLate === 1 ? "" : "s"} late)`;
}

function paceRowStyle(p: Pace) {
  return p === "none" ? undefined : { background: `color-mix(in srgb, ${PACE_COLOR[p]} 8%, transparent)` };
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
  const [performance, ips, byKind] = await Promise.all([
    getCohortPerformance(monthKey),
    getIpOverview(monthKey),
    getOutputByKind(monthKey),
  ]);
  // The floor's target is its scope: every post planned on Log it this month (rejected ones excluded).
  const floor = performance.all.total;
  const pct = floor.pct;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Everything that's been logged for the month, at a glance"
        right={<MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} />}
      />

      <Card className="p-6 mb-5">
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {monthKeyLabel(monthKey, "long")} · Total output vs. scope
        </div>
        <div className="flex items-end gap-3 mt-2">
          <div className="text-[48px] font-extrabold tabular-nums leading-none" style={{ color: PACE_COLOR[paceOf(performance.all)] }}>
            {pct}%
          </div>
          <div className="text-[13px] pb-2" style={{ color: "var(--text-muted)" }}>
            {floor.achieved} live of {floor.target} planned
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar pct={pct} color={PACE_COLOR[paceOf(performance.all)]} />
        </div>
        <div className="text-[10.5px] mt-2" style={{ color: "var(--text-muted)" }}>
          Total output on the floor: IP + Non-IP + Festive. Scope = every post planned on Log it for the month; rejected posts drop out.
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
          subtitle={`${monthKeyLabel(monthKey, "long")} · delivered / scope (scope = posts planned on Log it), by account director · green = on schedule · orange = posts up to ${SLIPPING_DAYS} days late · red = later than that`}
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
                const p = paceOf(r);
                return (
                  <tr key={r.id} title={paceTitle(r)} style={paceRowStyle(p)}>
                    <Td className="font-bold" style={{ color: p === "none" ? undefined : PACE_COLOR[p] }}>
                      <span title={r.code}>{r.leaderName}</span>
                    </Td>
                    <Td align="right" className="tabular-nums">{r.brandCount}</Td>
                    <Td align="right" className="tabular-nums">{r.ip.achieved}/{r.ip.target}</Td>
                    <Td align="right" className="tabular-nums">{r.nonIp.achieved}/{r.nonIp.target}</Td>
                    <Td align="right" className="tabular-nums">{r.festive.achieved}/{r.festive.target}</Td>
                    <Td align="right" className="tabular-nums font-bold">{r.total.achieved}/{r.total.target}</Td>
                    <Td align="right" className="tabular-nums font-bold" style={{ color: PACE_COLOR[p] }}>
                      {r.total.target ? `${r.total.pct}%` : "—"}
                    </Td>
                    <Td className="min-w-[140px]">
                      <ProgressBar pct={r.total.pct} color={PACE_COLOR[p]} />
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
                <Td align="right" className="tabular-nums font-extrabold" style={{ color: PACE_COLOR[paceOf(performance.all)] }}>
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
