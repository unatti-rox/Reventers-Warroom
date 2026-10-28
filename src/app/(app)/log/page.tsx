import { PageHeader, Card, CardHead, EmptyNote } from "@/components/ui";
import { MonthSwitcher } from "@/components/Switchers";
import { CalendarBrandCard } from "@/components/CalendarBrandCard";
import { TaskListRow } from "@/components/TaskListRow";
import { getCalendarCohortView, getIpTaskList, getFestivals } from "@/lib/queries";
import { currentMonthKey, monthKeyLabel, yearMonths, yearStartFor, daysFromToday } from "@/lib/dates";
import { requireUser } from "@/lib/auth";
import { paceOf, inPlanningWindow, PACE_COLOR, PACE_LABEL, PLANNING_WINDOW, SLIPPING_DAYS } from "@/lib/pace";
import { isPlanned } from "@/lib/entryStatus";

function urgency(dueDate: string): { label: string; color: string } {
  const days = daysFromToday(dueDate);
  if (days < 0) return { label: "Overdue", color: "var(--status-critical)" };
  if (days <= 7) return { label: "Due this week", color: "var(--status-warning)" };
  return { label: "Due later", color: "var(--text-muted)" };
}

export default async function LogItPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const now = currentMonthKey();
  const params = await searchParams;
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;

  const showCalendar = user.isAdmin || user.cohortIds.length > 0;
  // "Not planned" flags only show for next month, between the 22nd and 25th.
  const flagNotPlanned = inPlanningWindow(monthKey);
  const showTasks = user.ipcsIpIds.length > 0;

  const [calendarView, taskView, festivals] = await Promise.all([
    showCalendar ? getCalendarCohortView(user.isAdmin ? "all" : user.cohortIds, monthKey) : null,
    showTasks ? getIpTaskList(user.ipcsIpIds) : [],
    showCalendar ? getFestivals() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Log it"
        subtitle={showCalendar ? "Plan the month's posts once — everyone's dashboard and every IP CS's task list follow from this" : "Your task list, soonest due date first"}
        right={showCalendar ? <MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} /> : undefined}
      />

      {!calendarView && taskView.length === 0 && <EmptyNote>Nothing to log here — this page is for cohort leaders and IP CS.</EmptyNote>}

      {taskView.map(({ ip, tasks }) => (
        <Card key={ip.id} className="mb-5">
          <CardHead title={ip.name} subtitle={`${tasks.length} not yet live`} />
          <div>
            {tasks.map((t) => {
              const { label, color } = urgency(t.dueDate);
              return (
                <TaskListRow
                  key={t.id}
                  entryId={t.id}
                  status={t.status}
                  brandName={t.brandName}
                  cohortCode={t.cohortCode}
                  title={t.title}
                  postDate={t.postDate}
                  dueDate={t.dueDate}
                  urgencyLabel={label}
                  urgencyColor={color}
                />
              );
            })}
            {tasks.length === 0 && <EmptyNote>Nothing pending — every planned post for {ip.name} is live.</EmptyNote>}
          </div>
        </Card>
      ))}

      {calendarView &&
        calendarView.map((cohort) => {
          const pace = paceOf(cohort.brands.flatMap((b) => b.entries));
          const notPlanned = cohort.brands.filter((b) => !b.entries.some((e) => isPlanned(e.status))).length;
          return (
            <div key={cohort.id} className="mb-6">
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                {cohort.code} · {cohort.leaderName}
                {pace.pace !== "none" && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] normal-case tracking-normal"
                    style={{ color: PACE_COLOR[pace.pace], background: `color-mix(in srgb, ${PACE_COLOR[pace.pace]} 12%, transparent)` }}
                    title={pace.note}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: PACE_COLOR[pace.pace] }} />
                    {PACE_LABEL[pace.pace]}
                    {pace.late > 0 ? ` · ${pace.late} late` : ""}
                  </span>
                )}
                {flagNotPlanned && notPlanned > 0 && (
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] normal-case tracking-normal"
                    style={{ borderColor: "var(--border)" }}
                    title={`No posts planned for ${monthKeyLabel(monthKey)} yet - planning closes on the ${PLANNING_WINDOW.to}th`}
                  >
                    {notPlanned} of {cohort.brands.length} brand{cohort.brands.length === 1 ? "" : "s"} not planned
                  </span>
                )}
              </h2>
              {cohort.brands.map((brand) => (
                <CalendarBrandCard
                  key={brand.id}
                  brandId={brand.id}
                  brandName={brand.name}
                  ips={cohort.ips}
                  entries={brand.entries}
                  festivals={festivals}
                  monthKey={monthKey}
                  flagNotPlanned={flagNotPlanned}
                />
              ))}
              {cohort.brands.length === 0 && (
                <div className="text-[11px] py-3" style={{ color: "var(--text-muted)" }}>
                  No brands in this cohort yet.
                </div>
              )}
            </div>
          );
        })}

      {calendarView && (
        <p className="text-[10.5px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
          Plan {monthKeyLabel(monthKey)}&apos;s posts here — switch the month above to get next month&apos;s calendar in early. Green = every post
          past its date is live · orange = posts up to {SLIPPING_DAYS} days late · red = later than that.
        </p>
      )}
    </div>
  );
}
