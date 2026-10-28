import { prisma } from "@/lib/prisma";
import { PersonRole, EntryKind, EntryStatus, type PlanFormat } from "@/generated/prisma/enums";
import { currentMonthKey, addDays } from "@/lib/dates";

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

/** Target = how many entries were planned; achieved = planned pieces produced or live; live = posted. No numbers typed anywhere - this is pure counting. */
function summarize(entries: { status: EntryStatus }[]): Summary {
  const target = entries.length;
  const achieved = entries.filter((e) => e.status !== EntryStatus.PENDING).length;
  const live = entries.filter((e) => e.status === EntryStatus.LIVE).length;
  return { target, achieved, live, pct: target ? Math.min(100, Math.round((achieved / target) * 100)) : 0 };
}

/** Each cohort's IP delivery for the month, from the calendar. */
export async function getCohortOverview(monthKey: string) {
  const [cohorts, entries] = await Promise.all([
    getCohorts(monthKey),
    prisma.calendarEntry.findMany({ where: { monthKey, kind: EntryKind.REGULAR }, select: { brandId: true, status: true } }),
  ]);
  return cohorts.map((cohort) => {
    const brandIds = new Set(cohort.brands.map((b) => b.id));
    const mine = entries.filter((e) => brandIds.has(e.brandId));
    return { id: cohort.id, code: cohort.code, leaderName: cohort.leaderName, brandCount: cohort.brands.length, ...summarize(mine) };
  });
}

/** Each IP's delivery for the month, from the calendar. */
export async function getIpOverview(monthKey: string) {
  const [ips, entries] = await Promise.all([
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.calendarEntry.findMany({ where: { monthKey, kind: EntryKind.REGULAR }, select: { ipId: true, status: true } }),
  ]);
  return ips.map((ip) => {
    const mine = entries.filter((e) => e.ipId === ip.id);
    return { id: ip.id, name: ip.name, ...summarize(mine) };
  });
}

/** Festive & Non-IP totals for the month (the same calendar, just the other two kinds). */
/** This month's planned / achieved / live, split into IP, Non-IP and Festive. */
export async function getOutputByKind(monthKey: string) {
  const rows = await prisma.calendarEntry.findMany({
    where: { monthKey },
    select: { kind: true, status: true },
  });
  const sumBy = (kind: EntryKind) => summarize(rows.filter((r) => r.kind === kind));
  return { ip: sumBy(EntryKind.REGULAR), nonIp: sumBy(EntryKind.NON_IP), festive: sumBy(EntryKind.FESTIVAL) };
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

type Cell = { target: number; achieved: number; live: number };

/** The full brand × IP read view, for the Dashboard's drill-down table. */
export async function getMatrix(monthKey: string) {
  const [cohorts, ips, entries] = await Promise.all([
    getCohorts(monthKey),
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.calendarEntry.findMany({ where: { monthKey, kind: EntryKind.REGULAR }, select: { brandId: true, ipId: true, status: true } }),
  ]);
  const cellMap = new Map<string, Cell>();
  for (const e of entries) {
    if (!e.ipId) continue;
    const key = `${e.brandId}:${e.ipId}`;
    const cell = cellMap.get(key) ?? { target: 0, achieved: 0, live: 0 };
    cell.target += 1;
    if (e.status !== EntryStatus.PENDING) cell.achieved += 1;
    if (e.status === EntryStatus.LIVE) cell.live += 1;
    cellMap.set(key, cell);
  }
  return { cohorts, ips, cellMap };
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
    where: { ipId: { in: ipIds }, kind: EntryKind.REGULAR, status: { not: EntryStatus.LIVE } },
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
    prisma.calendarEntry.findMany({ where: { kind: EntryKind.REGULAR, status: { not: EntryStatus.LIVE } }, select: { ipId: true, postDate: true } }),
    prisma.calendarEntry.findMany({ where: { kind: EntryKind.REGULAR, monthKey }, select: { ipId: true, status: true } }),
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
    prisma.shoot.findMany({ where: { date: { startsWith: monthKey } }, orderBy: { date: "asc" } }),
  ]);
  return { cohorts, ips, shoots };
}
