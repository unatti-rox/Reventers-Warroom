import { prisma } from "@/lib/prisma";
import { PersonRole, EntryKind, EntryStatus, IpCategory, type PlanFormat } from "@/generated/prisma/enums";
import { currentMonthKey, addDays, todayDateStr } from "@/lib/dates";
import { OPEN, isDelivered, isPlanned } from "@/lib/entryStatus";
import { outputKindOf, type OutputKind } from "@/lib/outputKind";

/** Brands that count in a given month (not archived before it). */
function activeIn(monthKey: string) {
  return { OR: [{ archivedMonthKey: null }, { archivedMonthKey: { gt: monthKey } }] };
}

export async function getKpis() {
  const monthKey = currentMonthKey();
  const [cohorts, brands, ips, people] = await Promise.all([
    prisma.cohort.count(),
    prisma.brand.count({ where: activeIn(monthKey) }),
    prisma.ip.count(),
    prisma.person.findMany({ where: { active: true }, select: { appRole: true } }),
  ]);
  const count = (role: string) => people.filter((p) => p.appRole === role).length;
  return {
    cohorts,
    brands,
    ips,
    ipcs: count("IP_CS"),
    designers: count("DESIGNER"),
    editors: count("EDITOR"),
    floaters: count("FLOATER"),
  };
}

export async function getCohorts(monthKey = currentMonthKey()) {
  return prisma.cohort.findMany({
    orderBy: { code: "asc" },
    include: { brands: { where: activeIn(monthKey), orderBy: { name: "asc" } }, leader: true },
  });
}

/** "C1 · Aasawari" */
export function cohortLabel(c: { code: string; leaderName: string }) {
  return `${c.code} · ${c.leaderName}`;
}

type Summary = { target: number; achieved: number; live: number; pct: number };

/** Target = how many entries are planned (rejected ones drop out); achieved = live = posted. No numbers typed anywhere - this is pure counting. */
function summarize(all: { status: EntryStatus }[]): Summary {
  const entries = all.filter((e) => isPlanned(e.status));
  const target = entries.length;
  const achieved = entries.filter((e) => isDelivered(e.status)).length;
  const live = entries.filter((e) => e.status === EntryStatus.LIVE).length;
  return { target, achieved, live, pct: target ? Math.min(100, Math.round((achieved / target) * 100)) : 0 };
}

/**
 * The dashboard's cohort performance table: per cohort (shown by its
 * account director), this month's IP, Non-IP and Festive delivered/planned
 * and the combined total, plus an all-cohorts row. `late` counts planned
 * posts whose date has passed and that aren't live yet - a cohort with any
 * is behind schedule.
 */
export async function getCohortPerformance(monthKey: string) {
  const [cohorts, entries] = await Promise.all([
    getCohorts(monthKey),
    prisma.calendarEntry.findMany({ where: { monthKey }, select: { brandId: true, kind: true, status: true, postDate: true, ip: { select: { category: true } } } }),
  ]);
  const today = todayDateStr();
  const breakdown = (rows: typeof entries) => ({
    late: rows.filter((e) => isPlanned(e.status) && e.status !== EntryStatus.LIVE && e.postDate < today).length,
    ip: summarize(rows.filter((e) => outputKindOf(e) === "ip")),
    nonIp: summarize(rows.filter((e) => outputKindOf(e) === "nonIp")),
    festive: summarize(rows.filter((e) => outputKindOf(e) === "festive")),
    total: summarize(rows),
  });
  const rows = cohorts.map((cohort) => {
    const brandIds = new Set(cohort.brands.map((b) => b.id));
    return {
      id: cohort.id,
      code: cohort.code,
      leaderName: cohort.leaderName,
      brandCount: cohort.brands.length,
      ...breakdown(entries.filter((e) => brandIds.has(e.brandId))),
    };
  });
  rows.sort((x, y) => x.leaderName.localeCompare(y.leaderName));
  const allBrandIds = new Set(cohorts.flatMap((c) => c.brands.map((b) => b.id)));
  const all = {
    brandCount: allBrandIds.size,
    ...breakdown(entries.filter((e) => allBrandIds.has(e.brandId))),
  };
  return { rows, all };
}

/** Each IP bucket's delivery for the month, from the calendar (Non-IP and festive buckets aren't listed). */
export async function getIpOverview(monthKey: string) {
  const [ips, entries] = await Promise.all([
    // Current content buckets only: old launch-era IP names sit at sortOrder >= 1000 (see applyContentBucketRelist in seed.ts).
    prisma.ip.findMany({ where: { sortOrder: { lt: 1000 }, category: IpCategory.IP }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.calendarEntry.findMany({ where: { monthKey, kind: EntryKind.REGULAR }, select: { ipId: true, status: true } }),
  ]);
  return ips.map((ip) => {
    const mine = entries.filter((e) => e.ipId === ip.id);
    return { id: ip.id, name: ip.name, ...summarize(mine) };
  });
}

/** This month's planned / achieved / live, split into IP, Non-IP and Festive. */
export async function getOutputByKind(monthKey: string) {
  const rows = await prisma.calendarEntry.findMany({
    where: { monthKey },
    select: { kind: true, status: true, ip: { select: { category: true } } },
  });
  const sumBy = (kind: OutputKind) => summarize(rows.filter((r) => outputKindOf(r) === kind));
  return { ip: sumBy("ip"), nonIp: sumBy("nonIp"), festive: sumBy("festive") };
}

/** Every IP with who handles it, and which cohorts it's fixed to. */
export async function getIpTeams() {
  const ips = await prisma.ip.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      assignments: { include: { person: true }, orderBy: { person: { name: "asc" } } },
      cohorts: { orderBy: { code: "asc" } },
    },
  });
  return ips.map((ip) => {
    const names = (role: PersonRole) => ip.assignments.filter((a) => a.role === role).map((a) => a.person.name);
    return {
      id: ip.id,
      name: ip.name,
      ipcs: names(PersonRole.IP_CS),
      designers: names(PersonRole.DESIGNER),
      editors: names(PersonRole.EDITOR),
      personIds: Array.from(new Set(ip.assignments.map((a) => a.personId))),
      cohorts: ip.cohorts,
    };
  });
}

/* ---------------- CALENDAR (the one input surface) ---------------- */

export type CalendarEntryRow = {
  id: string;
  kind: EntryKind;
  ipId: string | null;
  ipName: string | null;
  festivalId: string | null;
  festivalName: string | null;
  title: string;
  format: PlanFormat | null;
  postDate: string;
  status: EntryStatus;
};

/**
 * The cohort-leader Calendar view: their own brands, each with every
 * planned entry for the viewed month (any kind) and a form to add more.
 * Pass "all" for admins, who can plan for any cohort.
 */
export async function getCalendarCohortView(cohortIds: string[] | "all", monthKey: string) {
  const cohorts = await prisma.cohort.findMany({
    where: cohortIds === "all" ? {} : { id: { in: cohortIds } },
    orderBy: { code: "asc" },
    include: {
      brands: { where: activeIn(monthKey), orderBy: { name: "asc" } },
      ips: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
  const brandIds = cohorts.flatMap((c) => c.brands.map((b) => b.id));
  const entries =
    brandIds.length === 0
      ? []
      : await prisma.calendarEntry.findMany({
          where: { monthKey, brandId: { in: brandIds } },
          include: { ip: true, festival: true },
          orderBy: { postDate: "asc" },
        });
  const rowsByBrand = new Map<string, CalendarEntryRow[]>();
  for (const e of entries) {
    const row: CalendarEntryRow = {
      id: e.id,
      kind: e.kind,
      ipId: e.ipId,
      ipName: e.ip?.name ?? null,
      festivalId: e.festivalId,
      festivalName: e.festival?.name ?? null,
      title: e.title,
      format: e.format,
      postDate: e.postDate,
      status: e.status,
    };
    const list = rowsByBrand.get(e.brandId) ?? [];
    list.push(row);
    rowsByBrand.set(e.brandId, list);
  }
  return cohorts.map((cohort) => ({
    id: cohort.id,
    code: cohort.code,
    leaderName: cohort.leaderName,
    ips: cohort.ips,
    brands: cohort.brands.map((b) => ({ id: b.id, name: b.name, entries: rowsByBrand.get(b.id) ?? [] })),
  }));
}

export async function getCalendarBufferDays() {
  const row = await prisma.appSetting.findUnique({ where: { key: "calendar.bufferDays" } });
  const v = Number(row?.value);
  return Number.isFinite(v) && v > 0 ? v : 8;
}

export type TaskListEntry = {
  id: string;
  brandId: string;
  brandName: string;
  cohortCode: string;
  title: string;
  postDate: string;
  dueDate: string;
  status: EntryStatus;
};

/**
 * The IP CS task list: every not-yet-live REGULAR entry for their IP(s),
 * due date = post date minus the buffer, soonest first. This is the list
 * that answers "what should I focus on this week" without anyone assigning it.
 */
export async function getIpTaskList(ipIds: string[]) {
  if (ipIds.length === 0) return [];
  const bufferDays = await getCalendarBufferDays();
  const entries = await prisma.calendarEntry.findMany({
    where: { ipId: { in: ipIds }, kind: EntryKind.REGULAR, status: { in: OPEN } },
    include: { brand: { include: { cohort: true } }, ip: true },
    orderBy: { postDate: "asc" },
  });
  const byIp = new Map<string, TaskListEntry[]>();
  for (const e of entries) {
    const row: TaskListEntry = {
      id: e.id,
      brandId: e.brandId,
      brandName: e.brand.name,
      cohortCode: e.brand.cohort.code,
      title: e.title,
      postDate: e.postDate,
      dueDate: addDays(e.postDate, -bufferDays),
      status: e.status,
    };
    const list = byIp.get(e.ipId!) ?? [];
    list.push(row);
    byIp.set(e.ipId!, list);
  }
  const ips = await prisma.ip.findMany({ where: { id: { in: ipIds } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return ips.map((ip) => ({
    ip: { id: ip.id, name: ip.name },
    tasks: (byIp.get(ip.id) ?? []).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  }));
}

/** W1 = due dates 1-7, W2 = 8-14, W3 = 15-21, W4 = 22 to month end. */
function weekOfMonth(dateStr: string): 1 | 2 | 3 | 4 {
  const day = Number(dateStr.slice(8, 10));
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export type BucketWeeklyLoad = {
  ip: { id: string; name: string };
  /** Not-yet-live posts due each week of the month (due date = post date minus the buffer). */
  weeks: [number, number, number, number];
  /** Sum of weeks - still outstanding. */
  dueTotal: number;
  /** Every post planned for this bucket this month (post date in this month), live or not. */
  target: number;
  /** How many of those are already live. */
  live: number;
};

/**
 * For every bucket: how many not-yet-live posts are due each week of the
 * given month (due date = post date minus the buffer) - the view that
 * answers "how many outputs does each bucket need this week" without
 * anyone typing a number - plus the month's overall target and how much
 * of it is already live, so the weekly workload reads against real progress.
 */
export async function getBucketWeeklyLoad(monthKey: string): Promise<BucketWeeklyLoad[]> {
  const [bufferDays, ips, pending, monthEntries] = await Promise.all([
    getCalendarBufferDays(),
    prisma.ip.findMany({ where: { sortOrder: { lt: 1000 } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.calendarEntry.findMany({ where: { kind: EntryKind.REGULAR, status: { in: OPEN } }, select: { ipId: true, postDate: true } }),
    prisma.calendarEntry.findMany({ where: { kind: EntryKind.REGULAR, monthKey, status: { not: EntryStatus.REJECTED } }, select: { ipId: true, status: true } }),
  ]);
  return ips.map((ip) => {
    const weeks: [number, number, number, number] = [0, 0, 0, 0];
    for (const e of pending) {
      if (e.ipId !== ip.id) continue;
      const dueDate = addDays(e.postDate, -bufferDays);
      if (dueDate.slice(0, 7) !== monthKey) continue;
      weeks[weekOfMonth(dueDate) - 1] += 1;
    }
    const mine = monthEntries.filter((e) => e.ipId === ip.id);
    return {
      ip: { id: ip.id, name: ip.name },
      weeks,
      dueTotal: weeks.reduce((s, n) => s + n, 0),
      target: mine.length,
      live: mine.filter((e) => e.status === EntryStatus.LIVE).length,
    };
  });
}

/* ---------------- FESTIVE & NON-IP ---------------- */

export async function getFestivals(includeInactive = false) {
  return prisma.festival.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ month: "asc" }, { sortOrder: "asc" }],
  });
}

/* ---------------- SHOOT SCHEDULE ---------------- */

/** All shoots in a month, earliest first, plus the cohort list for the add form. */
export async function getShootsView(monthKey: string) {
  const [cohorts, ips, shoots] = await Promise.all([
    getCohorts(monthKey),
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.shoot.findMany({ where: { date: { startsWith: monthKey } }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
  ]);
  return { cohorts, ips, shoots };
}
