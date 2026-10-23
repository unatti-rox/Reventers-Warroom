import { PageHeader, Card, CardHead, Th, Td, EmptyNote, ProgressBar } from "@/components/ui";
import { MonthSwitcher } from "@/components/Switchers";
import { getBucketWeeklyLoad, getCalendarBufferDays } from "@/lib/queries";
import { currentMonthKey, yearMonths, yearStartFor } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

function cellColor(n: number): string {
  if (n === 0) return "var(--text-muted)";
  if (n >= 8) return "var(--status-critical)";
  if (n >= 4) return "var(--status-warning)";
  return "var(--text-primary)";
}

function statusColor(pct: number): string {
  if (pct >= 80) return "var(--status-good)";
  if (pct >= 50) return "var(--status-warning)";
  return "var(--status-critical)";
}

/**
 * Every bucket's output needs, week by week - computed from what cohort
 * leaders planned on the calendar, not typed in separately - plus the
 * month's overall target and how much of it is already live, so the
 * weekly workload reads against real progress.
 */
export default async function WorkloadPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();
  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;

  const [rows, bufferDays] = await Promise.all([getBucketWeeklyLoad(monthKey), getCalendarBufferDays()]);
  const weekTotals = [0, 0, 0, 0].map((_, w) => rows.reduce((s, r) => s + r.weeks[w], 0));
  const targetTotal = rows.reduce((s, r) => s + r.target, 0);
  const liveTotal = rows.reduce((s, r) => s + r.live, 0);

  return (
    <div>
      <PageHeader
        title="Weekly Load"
        subtitle={`Due date = post date minus ${bufferDays} day${bufferDays === 1 ? "" : "s"} (set in Admin) · week columns use the due date, Target/Live use the post date`}
        right={<MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} />}
      />
      <Card>
        <CardHead title="Outputs needed per bucket" subtitle="Still-outstanding posts by the week production is due, plus the month's target and how much is already live" />
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <Th>Bucket</Th>
                <Th align="right">W1</Th>
                <Th align="right">W2</Th>
                <Th align="right">W3</Th>
                <Th align="right">W4</Th>
                <Th align="right">Due</Th>
                <Th align="right">Target</Th>
                <Th align="right">Live</Th>
                <Th>Progress</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.target ? Math.min(100, Math.round((r.live / r.target) * 100)) : 0;
                return (
                  <tr key={r.ip.id}>
                    <Td className="font-bold">{r.ip.name}</Td>
                    {r.weeks.map((n, i) => (
                      <Td key={i} align="right" className="tabular-nums font-bold" style={{ color: cellColor(n) }}>
                        {n}
                      </Td>
                    ))}
                    <Td align="right" className="tabular-nums font-bold">
                      {r.dueTotal}
                    </Td>
                    <Td align="right" className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {r.target}
                    </Td>
                    <Td align="right" className="tabular-nums font-bold">
                      {r.live}
                    </Td>
                    <Td style={{ minWidth: 100 }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar pct={pct} color={statusColor(pct)} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color: statusColor(pct) }}>
                          {pct}%
                        </span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr style={{ background: "var(--surface-tint)" }}>
                  <Td className="font-bold">Total</Td>
                  {weekTotals.map((n, i) => (
                    <Td key={i} align="right" className="tabular-nums font-bold">
                      {n}
                    </Td>
                  ))}
                  <Td align="right" className="tabular-nums font-bold">
                    {weekTotals.reduce((s, n) => s + n, 0)}
                  </Td>
                  <Td align="right" className="tabular-nums font-bold">
                    {targetTotal}
                  </Td>
                  <Td align="right" className="tabular-nums font-bold">
                    {liveTotal}
                  </Td>
                  <Td />
                </tr>
              )}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyNote>No buckets yet — add IPs in Admin → IP Teams.</EmptyNote>}
        </div>
      </Card>
    </div>
  );
}
