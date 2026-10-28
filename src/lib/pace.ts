import { EntryStatus } from "@/generated/prisma/enums";
import { isPlanned } from "@/lib/entryStatus";
import { addMonths, daysFromToday, todayDateStr } from "@/lib/dates";

/** How many days late a post can be before its cohort or brand counts as behind rather than slipping. */
export const SLIPPING_DAYS = 2;

export type Pace = "none" | "onTrack" | "slipping" | "behind";

export const PACE_COLOR: Record<Pace, string> = {
  none: "var(--text-muted)",
  onTrack: "var(--status-good)",
  slipping: "var(--status-warning)",
  behind: "var(--status-critical)",
};

export const PACE_LABEL: Record<Pace, string> = {
  none: "Nothing planned",
  onTrack: "On track",
  slipping: "Slipping",
  behind: "Behind",
};

/**
 * Grades a set of planned posts against their dates. Late = planned (not
 * rejected), not live, and its post date has passed. Green when none are
 * late, orange when the latest is at most SLIPPING_DAYS late, red beyond
 * that; grey when nothing is planned.
 */
export function paceOf(entries: { status: EntryStatus; postDate: string }[]) {
  const planned = entries.filter((e) => isPlanned(e.status));
  const today = todayDateStr();
  const late = planned.filter((e) => e.status !== EntryStatus.LIVE && e.postDate < today);
  const daysLate = late.reduce((max, e) => Math.max(max, -daysFromToday(e.postDate)), 0);
  const pace: Pace = planned.length === 0 ? "none" : late.length === 0 ? "onTrack" : daysLate <= SLIPPING_DAYS ? "slipping" : "behind";
  const note =
    late.length === 0
      ? PACE_LABEL[pace]
      : `${PACE_LABEL[pace]}: ${late.length} post${late.length === 1 ? "" : "s"} past ${late.length === 1 ? "its" : "their"} date and not live (up to ${daysLate} day${daysLate === 1 ? "" : "s"} late)`;
  return { pace, late: late.length, daysLate, note };
}

/** Days of the month (inclusive) when next month's calendar is planned and closed. */
export const PLANNING_WINDOW = { from: 22, to: 25 };

/** True when `monthKey` is next month and today falls in the planning window - the only time "not planned" flags show. */
export function inPlanningWindow(monthKey: string, today: string = todayDateStr()): boolean {
  const day = Number(today.slice(8, 10));
  return monthKey === addMonths(today.slice(0, 7), 1) && day >= PLANNING_WINDOW.from && day <= PLANNING_WINDOW.to;
}
