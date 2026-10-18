import Link from "next/link";
import { PageHeader, Card, CardHead, KpiTile, Th, Td, EmptyNote } from "@/components/ui";
import { MonthSwitcher } from "@/components/Switchers";
import { ClockPanel } from "@/components/AttendanceControls";
import { AbsenceBadge } from "@/components/AbsenceBadge";
import { getAttendanceOverview, getIpAbsenteeism, getMyAttendance, getOpenDay } from "@/lib/queries";
import { requireUser, ROLE_LABEL } from "@/lib/auth";
import { dayStatus, hoursWorked, STANDARD_MONTH_DAYS } from "@/lib/attendance";
import { currentMonthKey, monthKeyLabel, timeLabel, todayDateStr, yearMonths, yearStartFor } from "@/lib/dates";

const STATUS_LABEL = { present: "Present", half: "Half day", open: "In progress", "missing-out": "No clock-out" } as const;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;
  const months = yearMonths(yearStartFor(now)).filter((m) => m <= now);

  if (user.isAdmin) return <AdminAttendance monthKey={monthKey} months={months} />;

  const today = todayDateStr();
  const [{ days, summary }, open] = await Promise.all([getMyAttendance(user.id, monthKey), getOpenDay(user.id)]);
  const todays = monthKey === now ? days.find((d) => d.day === today) : (await getMyAttendance(user.id, now)).days.find((d) => d.day === today);
  const missing = open && open.day < today ? { day: open.day, clockIn: timeLabel(open.clockIn) } : null;

  return (
    <div>
      <PageHeader title="My attendance" subtitle="Clock in when you start and clock out when you finish. Only you and the admins can see this." right={<MonthSwitcher monthKeys={months} current={monthKey} />} />
      <Card className="mb-5">
        <CardHead title={`Today · ${today}`} subtitle="8+ hours counts as a full day; less is a half day." />
        <ClockPanel
          today={today}
          clockedInAt={todays ? timeLabel(todays.clockIn) : null}
          clockedOutAt={todays?.clockOut ? timeLabel(todays.clockOut) : null}
          missingDay={missing}
        />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiTile label="Present" value={summary.present} meta={`of ${summary.denominator} days`} />
        <KpiTile label="Half days" value={summary.half} meta="Under 8 hours" />
        <KpiTile label="Absent" value={summary.absent} meta={`Absence ${summary.absenceRate}%`} />
        <KpiTile label="Hours" value={summary.hours} meta={monthKeyLabel(monthKey)} />
      </div>

      <Card>
        <CardHead title="My log" subtitle="Only admins can correct past entries." />
        {days.length === 0 ? (
          <EmptyNote>Nothing logged in {monthKeyLabel(monthKey)} yet.</EmptyNote>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>In</Th>
                  <Th>Out</Th>
                  <Th align="right">Hours</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const h = hoursWorked(d.clockIn, d.clockOut);
                  return (
                    <tr key={d.id}>
                      <Td className="font-semibold">{d.day}</Td>
                      <Td className="tabular-nums">{timeLabel(d.clockIn)}</Td>
                      <Td className="tabular-nums">{d.clockOut ? timeLabel(d.clockOut) : "—"}</Td>
                      <Td align="right" className="tabular-nums">{h === null ? "—" : h.toFixed(1)}</Td>
                      <Td>
                        {STATUS_LABEL[dayStatus(d.day, d.clockIn, d.clockOut)]}
                        {d.note ? <span className="text-[9.5px] ml-1.5" style={{ color: "var(--text-muted)" }}>({d.note})</span> : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

async function AdminAttendance({ monthKey, months }: { monthKey: string; months: string[] }) {
  const [overview, ipRanking] = await Promise.all([getAttendanceOverview(monthKey), getIpAbsenteeism(monthKey)]);
  const tracked = overview.filter((o) => o.summary.denominator > 0);
  const avg = tracked.length ? Math.round(tracked.reduce((s, o) => s + o.summary.absenceRate, 0) / tracked.length) : 0;
  const worst = ipRanking[0];

  return (
    <div>
      <PageHeader
        title="Attendance overview"
        subtitle={`Admins only. Each month counts as ${STANDARD_MONTH_DAYS} days (the current month counts the days so far). Click a name for their month.`}
        right={<MonthSwitcher monthKeys={months} current={monthKey} />}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiTile label="People tracked" value={overview.length} meta="IP CS, designers, editors" />
        <KpiTile label="Average absence" value={`${avg}%`} meta={monthKeyLabel(monthKey)} />
        <KpiTile label="No clock-out" value={overview.reduce((s, o) => s + o.summary.missingOut, 0)} meta="Days to fix" />
        <KpiTile label="Highest-absence IP" value={worst && worst.absenceRate > 0 ? `${worst.absenceRate}%` : "—"} meta={worst && worst.absenceRate > 0 ? worst.ip.name : "No absences yet"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
        <Card>
          <CardHead title="Team" subtitle="Present = 8+ hours · half day = under 8 hours" />
          <div className="overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th align="right">Present</Th>
                  <Th align="right">Half days</Th>
                  <Th align="right">No clock-out</Th>
                  <Th align="right">Absent</Th>
                  <Th align="right">Absence</Th>
                </tr>
              </thead>
              <tbody>
                {overview.map(({ person, summary }) => (
                  <tr key={person.id}>
                    <Td className="font-bold">
                      <Link href={`/attendance/${person.id}?month=${monthKey}`} className="underline decoration-dotted" style={{ color: "var(--brand-ink)" }}>
                        {person.name}
                      </Link>
                    </Td>
                    <Td>{ROLE_LABEL[person.appRole]}</Td>
                    <Td align="right" className="tabular-nums">
                      {summary.present} / {summary.denominator}
                    </Td>
                    <Td align="right" className="tabular-nums">{summary.half}</Td>
                    <Td align="right" className="tabular-nums" style={{ color: summary.missingOut ? "var(--status-critical)" : undefined }}>
                      {summary.missingOut}
                    </Td>
                    <Td align="right" className="tabular-nums">{summary.absent}</Td>
                    <Td align="right">
                      <AbsenceBadge rate={summary.absenceRate} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead title="Absenteeism by IP team" subtitle="IP CS + designers + editors, averaged. Highest first." />
          <div>
            {ipRanking.map((r, i) => (
              <div
                key={r.ip.id}
                className="flex items-center justify-between gap-3 px-5 py-2.5 border-b last:border-0"
                style={{ borderColor: "var(--border)", background: i === 0 && r.absenceRate > 0 ? "var(--status-critical-bg)" : undefined }}
              >
                <div className="min-w-0">
                  <div className="text-[11.5px] font-bold">
                    {r.ip.name}
                    {i === 0 && r.absenceRate > 0 && (
                      <span className="ml-2 text-[9px] font-bold uppercase" style={{ color: "var(--status-critical)" }}>
                        highest
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] truncate" style={{ color: "var(--text-muted)" }}>
                    {[...r.ip.ipcs, ...r.ip.designers, ...r.ip.editors].join(", ")} · {r.absentDays} absent days
                  </div>
                </div>
                <AbsenceBadge rate={r.absenceRate} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
