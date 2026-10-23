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

export function monthKeyFromDateStr(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Adds (or, with a negative n, subtracts) days from a "YYYY-MM-DD" date string. */
export function addDays(dateStr: string, n: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Whole days from today to a "YYYY-MM-DD" date (negative if it's in the past). */
export function daysFromToday(dateStr: string): number {
  const today = todayDateStr();
  const [ty, tm, td] = today.split("-").map(Number);
  const [y, m, d] = dateStr.split("-").map(Number);
  const msPerDay = 86400_000;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / msPerDay);
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
