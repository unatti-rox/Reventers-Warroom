import { PageHeader, Card, CardHead, Th, Td, EmptyNote } from "@/components/ui";
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

/**
 * Every bucket's output needs, week by week - computed from what cohort
 * leaders planned on the calendar, not typed in separately. Answers
 * "how many outputs does each bucket need this week" for every IP CS at a glance.
 */
export default async function WorkloadPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();
  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;

  const [rows, bufferDays] = await Promise.all([getBucketWeeklyLoad(monthKey), getCalendarBufferDays()]);
  const totals = [0, 0, 0, 0].map((_, w) => rows.reduce((s, r) => s + r.weeks[w], 0));

  return (
    <div>
      <PageHeader
        title="Weekly Load"
        subtitle={`Due date = post date minus ${bufferDays} day${bufferDays === 1 ? "" : "s"} (set in Admin) · week of the due date, not the post date`}
        right={<MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} />}
      />
      <Card>
        <CardHead title="Outputs needed per bucket" subtitle="Planned posts not yet live, grouped by which week their production is due" />
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <Th>Bucket</Th>
                <Th align="right">W1</Th>
                <Th align="right">W2</Th>
                <Th align="right">W3</Th>
                <Th align="right">W4</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ip.id}>
                  <Td className="font-bold">{r.ip.name}</Td>
                  {r.weeks.map((n, i) => (
                    <Td key={i} align="right" className="tabular-nums font-bold" style={{ color: cellColor(n) }}>
                      {n}
                    </Td>
                  ))}
                  <Td align="right" className="tabular-nums font-bold">
                    {r.total}
                  </Td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr style={{ background: "var(--surface-tint)" }}>
                  <Td className="font-bold">Total</Td>
                  {totals.map((n, i) => (
                    <Td key={i} align="right" className="tabular-nums font-bold">
                      {n}
                    </Td>
                  ))}
                  <Td align="right" className="tabular-nums font-bold">
                    {totals.reduce((s, n) => s + n, 0)}
                  </Td>
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
