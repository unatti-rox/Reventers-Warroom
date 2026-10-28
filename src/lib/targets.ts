import { prisma } from "@/lib/prisma";
import { EntryKind, EntryStatus } from "@/generated/prisma/enums";
import { currentMonthKey, yearMonths } from "@/lib/dates";

export const DEFAULT_BASE = 192;
export const DEFAULT_PER_BRAND = 4;

export async function getTargetSettings() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: ["target.baseMonthly", "target.perBrand"] } } });
  const get = (key: string, fallback: number) => {
    const v = Number(rows.find((r) => r.key === key)?.value);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return { baseMonthly: get("target.baseMonthly", DEFAULT_BASE), perBrand: get("target.perBrand", DEFAULT_PER_BRAND) };
}

export type YearRow = {
  monthKey: string;
  timing: "past" | "current" | "future";
  base: number;
  baseIsOverride: boolean;
  newBrands: number;
  /** Shortfall carried in from the previous month; null while that month is still open. */
  backlogIn: number | null;
  target: number;
  /** Total output: IP + Non-IP + Festive (or the admin-entered total). */
  achieved: number;
  achievedIsOverride: boolean;
  /** Target minus achieved (past and current months). */
  gap: number | null;
  festive: { achieved: number; live: number };
  nonIp: { achieved: number; live: number };
  ipLive: number;
};

/**
 * The June–May year, month by month.
 *
 * Base = monthly base (192) + 4 for every brand added after launch that is
 * active that month, unless an admin set a base for that month.
 * The target covers total output on the floor: IP + Non-IP + Festive.
 * Target = base + the previous month's shortfall. A shortfall carries
 * forward (target − achieved, if positive); a surplus never lowers later
 * targets. The carry starts fresh each June.
 */
export async function getYearSummary(startYear: number) {
  const months = yearMonths(startYear);
  const first = months[0];
  const last = months[months.length - 1];
  const now = currentMonthKey();

  const [settings, brands, monthSettings, pieceTotals, pieceLive, festiveTotals, festiveLive, nonIpTotals, nonIpLive] = await Promise.all([
    getTargetSettings(),
    prisma.brand.findMany({ select: { addedMonthKey: true, archivedMonthKey: true } }),
    prisma.monthSetting.findMany({ where: { monthKey: { gte: first, lte: last } } }),
    prisma.calendarEntry.groupBy({
      by: ["monthKey"],
      where: { monthKey: { gte: first, lte: last }, kind: EntryKind.REGULAR, status: { not: EntryStatus.PENDING } },
      _count: { _all: true },
    }),
    prisma.calendarEntry.groupBy({
      by: ["monthKey"],
      where: { monthKey: { gte: first, lte: last }, kind: EntryKind.REGULAR, status: EntryStatus.LIVE },
      _count: { _all: true },
    }),
    prisma.calendarEntry.groupBy({
      by: ["monthKey"],
      where: { monthKey: { gte: first, lte: last }, kind: EntryKind.FESTIVAL, status: { not: EntryStatus.PENDING } },
      _count: { _all: true },
    }),
    prisma.calendarEntry.groupBy({
      by: ["monthKey"],
      where: { monthKey: { gte: first, lte: last }, kind: EntryKind.FESTIVAL, status: EntryStatus.LIVE },
      _count: { _all: true },
    }),
    prisma.calendarEntry.groupBy({
      by: ["monthKey"],
      where: { monthKey: { gte: first, lte: last }, kind: EntryKind.NON_IP, status: { not: EntryStatus.PENDING } },
      _count: { _all: true },
    }),
    prisma.calendarEntry.groupBy({
      by: ["monthKey"],
      where: { monthKey: { gte: first, lte: last }, kind: EntryKind.NON_IP, status: EntryStatus.LIVE },
      _count: { _all: true },
    }),
  ]);

  const rows: YearRow[] = [];
  let carry = 0;
  let carryKnown = true;
  for (const monthKey of months) {
    const timing = monthKey < now ? "past" : monthKey === now ? "current" : "future";
    const setting = monthSettings.find((s) => s.monthKey === monthKey);
    const newBrands = brands.filter(
      (b) => b.addedMonthKey && b.addedMonthKey <= monthKey && (!b.archivedMonthKey || b.archivedMonthKey > monthKey),
    ).length;
    const base = setting?.baseOverride ?? settings.baseMonthly + settings.perBrand * newBrands;
    const count = (rows: { monthKey: string; _count: { _all: number } }[]) => rows.find((x) => x.monthKey === monthKey)?._count._all ?? 0;
    // Total output on the floor: IP pieces + Non-IP + Festive.
    const achieved = setting?.achievedOverride ?? count(pieceTotals) + count(festiveTotals) + count(nonIpTotals);
    const backlogIn = carryKnown ? carry : null;
    const target = base + (backlogIn ?? 0);

    rows.push({
      monthKey,
      timing,
      base,
      baseIsOverride: setting?.baseOverride != null,
      newBrands,
      backlogIn,
      target,
      achieved,
      achievedIsOverride: setting?.achievedOverride != null,
      gap: timing === "future" ? null : target - achieved,
      festive: {
        achieved: festiveTotals.find((x) => x.monthKey === monthKey)?._count._all ?? 0,
        live: festiveLive.find((x) => x.monthKey === monthKey)?._count._all ?? 0,
      },
      nonIp: {
        achieved: nonIpTotals.find((x) => x.monthKey === monthKey)?._count._all ?? 0,
        live: nonIpLive.find((x) => x.monthKey === monthKey)?._count._all ?? 0,
      },
      ipLive: pieceLive.find((x) => x.monthKey === monthKey)?._count._all ?? 0,
    });

    // Only a finished month's shortfall is known and carried forward.
    if (timing === "past" && carryKnown) {
      carry = Math.max(0, target - achieved);
    } else {
      carryKnown = false;
    }
  }

  const current = rows.find((r) => r.timing === "current") ?? null;
  const toDate = rows.filter((r) => r.timing !== "future");
  const totals = {
    base: rows.reduce((s, r) => s + r.base, 0),
    achieved: rows.reduce((s, r) => s + r.achieved, 0),
    ipLive: rows.reduce((s, r) => s + r.ipLive, 0),
    baseToDate: toDate.reduce((s, r) => s + r.base, 0),
    festive: {
      achieved: rows.reduce((s, r) => s + r.festive.achieved, 0),
      live: rows.reduce((s, r) => s + r.festive.live, 0),
    },
    nonIp: {
      achieved: rows.reduce((s, r) => s + r.nonIp.achieved, 0),
      live: rows.reduce((s, r) => s + r.nonIp.live, 0),
    },
  };
  return { rows, totals, current, settings };
}
