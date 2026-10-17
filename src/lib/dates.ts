export const WEEKS = ["W1", "W2", "W3", "W4"] as const;
export type WeekKey = (typeof WEEKS)[number];

/** The team works in India; every "today" / "this month" is in India time. */
export const TIME_ZONE = "Asia/Kolkata";

function partsInZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** "YYYY-MM-DD" for a moment, in India time. */
export function dayKey(date: Date = new Date()): string {
  const { year, month, day } = partsInZone(date);
  return `${year}-${month}-${day}`;
}

export function todayDateStr(): string {
  return dayKey(new Date());
}

export function currentMonthKey(): string {
  return todayDateStr().slice(0, 7);
}

/** W1 = days 1-7, W2 = 8-14, W3 = 15-21, W4 = 22 to month end (see Weekly Rotation). */
export function currentWeekKey(): WeekKey {
  const day = Number(todayDateStr().slice(8, 10));
  if (day <= 7) return "W1";
  if (day <= 14) return "W2";
  if (day <= 21) return "W3";
  return "W4";
}

export function monthKeyFromDateStr(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthKeyLabel(monthKey: string, style: "long" | "short" = "long"): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString("en-US", { month: style, year: "numeric", timeZone: "UTC" });
}

export function addMonths(monthKey: string, n: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The working year runs June to May. Returns the June that starts it, e.g. 2026 for Sep 2026 or Mar 2027. */
export function yearStartFor(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return month >= 6 ? year : year - 1;
}

/** The 12 month keys of the June–May year starting in June of `startYear`. */
export function yearMonths(startYear: number): string[] {
  return Array.from({ length: 12 }, (_, i) => addMonths(`${startYear}-06`, i));
}

export function yearLabel(startYear: number): string {
  return `Jun ${startYear} – May ${startYear + 1}`;
}

/** Time of day in India, e.g. "09:42". */
export function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** A UTC moment for "HH:MM" on an India-time day (India is UTC+5:30 with no DST). */
export function istDateTime(dateStr: string, hhmm: string): Date {
  return new Date(`${dateStr}T${hhmm}:00+05:30`);
}
