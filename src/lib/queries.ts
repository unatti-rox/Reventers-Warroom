import { prisma } from "@/lib/prisma";
import { PersonRole, StatusState } from "@/generated/prisma/enums";
import { WEEKS, currentMonthKey, currentWeekKey, type WeekKey } from "@/lib/dates";
import { getOrCreateCycle, statusValue, effectiveAssignment } from "@/lib/rotation";

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

/** All logged pieces for a month: each tap of "Log it", plus whether it's live. */
async function getPieces(monthKey: string) {
  return prisma.piece.findMany({ where: { monthKey }, select: { brandId: true, ipId: true, live: true } });
}

/** Each cohort's IP delivery for the month: target from the matrix, achieved/live counted from logged pieces. */
export async function getCohortOverview(monthKey: string) {
  const [cohorts, targets, pieces] = await Promise.all([
    getCohorts(monthKey),
    prisma.brandIpMonth.findMany({ where: { monthKey }, select: { brandId: true, target: true } }),
    getPieces(monthKey),
  ]);
  return cohorts.map((cohort) => {
    const brandIds = new Set(cohort.brands.map((b) => b.id));
    const target = targets.filter((t) => brandIds.has(t.brandId)).reduce((s, t) => s + t.target, 0);
    const mine = pieces.filter((p) => brandIds.has(p.brandId));
    const achieved = mine.length;
    const live = mine.filter((p) => p.live).length;
    return {
      id: cohort.id,
      code: cohort.code,
      leaderName: cohort.leaderName,
      brandCount: cohort.brands.length,
      target,
      achieved,
      live,
      pct: target ? Math.min(100, Math.round((achieved / target) * 100)) : 0,
    };
  });
}

/** Each IP's delivery for the month: target from the matrix, achieved/live counted from logged pieces. */
export async function getIpOverview(monthKey: string) {
  const [ips, targets, pieces] = await Promise.all([
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brandIpMonth.findMany({ where: { monthKey }, select: { ipId: true, target: true } }),
    getPieces(monthKey),
  ]);
  return ips.map((ip) => {
    const target = targets.filter((t) => t.ipId === ip.id).reduce((s, t) => s + t.target, 0);
    const mine = pieces.filter((p) => p.ipId === ip.id);
    const achieved = mine.length;
    const live = mine.filter((p) => p.live).length;
    return {
      id: ip.id,
      name: ip.name,
      target,
      achieved,
      live,
      pct: target ? Math.min(100, Math.round((achieved / target) * 100)) : 0,
    };
  });
}

/** Simple counts for the admin Overview snapshot: one number per other section. */
export async function getOverviewExtras(monthKey: string) {
  const week = currentWeekKey();
  const cycle = await getOrCreateCycle(monthKey);
  const [cohorts, entries, weekTrades, allTrades, planned] = await Promise.all([
    prisma.cohort.findMany({ select: { id: true } }),
    prisma.rotationEntry.findMany({ where: { cycleId: cycle.id, week }, include: { assignments: true } }),
    prisma.trade.findMany({ where: { cycleId: cycle.id, week } }),
    prisma.trade.count({ where: { cycleId: cycle.id } }),
    prisma.plannedEntry.findMany({ where: { monthKey }, select: { live: true } }),
  ]);

  const assignedCohortCount = cohorts.filter((cohort) =>
    entries.some((entry) =>
      effectiveAssignment(
        entry.ipId,
        week,
        cohort.id,
        entry.assignments.map((a) => a.cohortId),
        weekTrades,
      ),
    ),
  ).length;

  const festiveNonIpDone = planned.filter((e) => e.live > 0).length;

  return {
    week,
    assignedCohortCount,
    totalCohortCount: cohorts.length,
    tradeCount: allTrades,
    festiveNonIpDone,
    festiveNonIpTotal: planned.length,
  };
}

/** Cohorts actually assigned to an IP this week (net of trades). */
async function getIpAssignedCohortIds(ipId: string, monthKey: string, week: WeekKey): Promise<Set<string>> {
  const cycle = await getOrCreateCycle(monthKey);
  const [entry, trades, cohorts] = await Promise.all([
    prisma.rotationEntry.findUnique({ where: { cycleId_ipId_week: { cycleId: cycle.id, ipId, week } }, include: { assignments: true } }),
    prisma.trade.findMany({ where: { cycleId: cycle.id, ipId, week } }),
    prisma.cohort.findMany({ select: { id: true } }),
  ]);
  const base = entry?.assignments.map((a) => a.cohortId) ?? [];
  const result = new Set<string>();
  for (const cohort of cohorts) {
    if (effectiveAssignment(ipId, week, cohort.id, base, trades)) result.add(cohort.id);
  }
  return result;
}

/**
 * For one IP CS: their own IP(s), each with only the brands whose cohort is
 * actually assigned to it this week (via the rotation, net of trades) — not
 * every brand in the org. Keeps the day-to-day list short. Numbers entered
 * still add to the IP's running monthly total (achieved/live are monthly).
 */
export async function getMyIpBrands(ipIds: string[], monthKey: string) {
  if (ipIds.length === 0) return [];
  const week = currentWeekKey();
  const [ips, allBrands, pieces] = await Promise.all([
    prisma.ip.findMany({ where: { id: { in: ipIds } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brand.findMany({ where: activeIn(monthKey), orderBy: { name: "asc" }, include: { cohort: true } }),
    prisma.piece.findMany({ where: { monthKey, ipId: { in: ipIds } }, select: { brandId: true, ipId: true, live: true } }),
  ]);
  return Promise.all(
    ips.map(async (ip) => {
      const cohortIds = await getIpAssignedCohortIds(ip.id, monthKey, week);
      const brands = allBrands.filter((b) => cohortIds.has(b.cohortId));
      return {
        ip,
        brands: brands.map((brand) => {
          const mine = pieces.filter((p) => p.ipId === ip.id && p.brandId === brand.id);
          return {
            brandId: brand.id,
            brandName: brand.name,
            cohortCode: brand.cohort.code,
            achieved: mine.length,
            live: mine.filter((p) => p.live).length,
          };
        }),
      };
    }),
  );
}

/** Every IP with who handles it. */
export async function getIpTeams() {
  const ips = await prisma.ip.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { assignments: { include: { person: true }, orderBy: { person: { name: "asc" } } } },
  });
  return ips.map((ip) => {
    const names = (role: PersonRole) => ip.assignments.filter((a) => a.role === role).map((a) => a.person.name);
    return {
      id: ip.id,
      name: ip.name,
      weeklyTarget: ip.defaultWeeklyTarget,
      ipcs: names(PersonRole.IP_CS),
      designers: names(PersonRole.DESIGNER),
      editors: names(PersonRole.EDITOR),
      personIds: Array.from(new Set(ip.assignments.map((a) => a.personId))),
    };
  });
}

type Cell = { target: number; achieved: number; live: number };

/** Combines a month's set targets with its logged-piece counts into one brand+IP cell map. */
function buildCellMap(targets: { brandId: string; ipId: string; target: number }[], pieces: { brandId: string; ipId: string; live: boolean }[]) {
  const cellMap = new Map<string, Cell>();
  for (const t of targets) {
    cellMap.set(`${t.brandId}:${t.ipId}`, { target: t.target, achieved: 0, live: 0 });
  }
  for (const p of pieces) {
    const key = `${p.brandId}:${p.ipId}`;
    const cell = cellMap.get(key) ?? { target: 0, achieved: 0, live: 0 };
    cell.achieved += 1;
    if (p.live) cell.live += 1;
    cellMap.set(key, cell);
  }
  return cellMap;
}

/** A cohort leader's own brands (across cohorts they lead), for the simple "My Brands" page. */
export async function getMyTargetBrands(cohortIds: string[], monthKey: string) {
  if (cohortIds.length === 0) return { brands: [], ips: [], cellMap: new Map<string, Cell>() };
  const [cohorts, ips, targets, pieces] = await Promise.all([
    prisma.cohort.findMany({
      where: { id: { in: cohortIds } },
      orderBy: { code: "asc" },
      include: { brands: { where: activeIn(monthKey), orderBy: { name: "asc" } } },
    }),
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brandIpMonth.findMany({
      where: { monthKey, brand: { cohortId: { in: cohortIds } } },
      select: { brandId: true, ipId: true, target: true },
    }),
    prisma.piece.findMany({
      where: { monthKey, brand: { cohortId: { in: cohortIds } } },
      select: { brandId: true, ipId: true, live: true },
    }),
  ]);
  const brands = cohorts.flatMap((c) => c.brands.map((b) => ({ id: b.id, name: b.name, cohortCode: c.code })));
  const cellMap = buildCellMap(targets, pieces);
  return { brands, ips, cellMap, multiCohort: cohorts.length > 1 };
}

export async function getMatrix(monthKey: string) {
  const [cohorts, ips, targets, pieces] = await Promise.all([
    getCohorts(monthKey),
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brandIpMonth.findMany({ where: { monthKey }, select: { brandId: true, ipId: true, target: true } }),
    getPieces(monthKey),
  ]);
  const cellMap = buildCellMap(targets, pieces);
  return { cohorts, ips, cellMap };
}

export async function getRotationView(monthKey: string) {
  await getOrCreateCycle(monthKey);
  const [cycle, teams, cohorts, pieces] = await Promise.all([
    prisma.rotationCycle.findUniqueOrThrow({
      where: { monthKey },
      include: { entries: { include: { assignments: true } }, trades: true },
    }),
    getIpTeams(),
    prisma.cohort.findMany({ orderBy: { code: "asc" } }),
    getPieces(monthKey),
  ]);

  const rows = teams.map((team) => {
    const byWeek = {} as Record<WeekKey, { target: number; cohortIds: string[]; tradeCount: number }>;
    for (const week of WEEKS) {
      const entry = cycle.entries.find((e) => e.ipId === team.id && e.week === week);
      byWeek[week] = {
        target: entry?.target ?? team.weeklyTarget,
        cohortIds: entry?.assignments.map((a) => a.cohortId) ?? [],
        tradeCount: cycle.trades.filter((t) => t.ipId === team.id && t.week === week).length,
      };
    }
    const monthTarget = WEEKS.reduce((s, w) => s + byWeek[w].target, 0);
    const mine = pieces.filter((p) => p.ipId === team.id);
    return { team, byWeek, monthTarget, achieved: mine.length, live: mine.filter((p) => p.live).length };
  });

  return { cycle, rows, cohorts };
}

export async function listCycleMonthKeys() {
  const cycles = await prisma.rotationCycle.findMany({ orderBy: { monthKey: "asc" }, select: { monthKey: true } });
  return cycles.map((c) => c.monthKey);
}

export async function getTrades(monthKey: string, ipId?: string) {
  const cycle = await prisma.rotationCycle.findUnique({ where: { monthKey } });
  if (!cycle) return [];
  return prisma.trade.findMany({
    where: { cycleId: cycle.id, ...(ipId ? { ipId } : {}) },
    include: { ip: true, releasedCohort: true, claimedCohort: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCohortWeeklyView(monthKey: string, cohortId: string, week: WeekKey) {
  const cycle = await getOrCreateCycle(monthKey);
  const entries = await prisma.rotationEntry.findMany({
    where: { cycleId: cycle.id, week },
    include: { ip: true, assignments: true },
  });
  const trades = await prisma.trade.findMany({ where: { cycleId: cycle.id, week } });
  const cohortStatuses = await prisma.cohortWeeklyStatus.findMany({
    where: { cycleId: cycle.id, cohortId, week },
  });

  const assignedEntries = entries.filter((entry) =>
    effectiveAssignment(
      entry.ipId,
      week,
      cohortId,
      entry.assignments.map((a) => a.cohortId),
      trades,
    ),
  );

  return assignedEntries
    .sort((a, b) => a.ip.sortOrder - b.ip.sortOrder)
    .map((entry) => {
      const status = cohortStatuses.find((s) => s.ipId === entry.ipId)?.status ?? StatusState.PENDING;
      return {
        ipId: entry.ipId,
        ipName: entry.ip.name,
        target: entry.target,
        status,
      };
    });
}

export async function getCohortMonthlySummary(monthKey: string) {
  const cycle = await getOrCreateCycle(monthKey);
  const cohorts = await prisma.cohort.findMany({ orderBy: { code: "asc" } });
  const entries = await prisma.rotationEntry.findMany({
    where: { cycleId: cycle.id },
    include: { assignments: true },
  });
  const trades = await prisma.trade.findMany({ where: { cycleId: cycle.id } });
  const cohortStatuses = await prisma.cohortWeeklyStatus.findMany({ where: { cycleId: cycle.id } });

  return cohorts.map((cohort) => {
    let target = 0;
    let achieved = 0;
    for (const entry of entries) {
      const assigned = effectiveAssignment(
        entry.ipId,
        entry.week as WeekKey,
        cohort.id,
        entry.assignments.map((a) => a.cohortId),
        trades,
      );
      if (!assigned) continue;
      target += 1;
      const status = cohortStatuses.find(
        (s) => s.ipId === entry.ipId && s.week === entry.week && s.cohortId === cohort.id,
      )?.status;
      achieved += status ? statusValue(status) : 0;
    }
    const pct = target ? Math.round((achieved / target) * 100) : 0;
    return { cohort, target, achieved, pct };
  });
}

/* ---------------- FESTIVE & NON-IP ---------------- */

export async function getFestivals(includeInactive = false) {
  return prisma.festival.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ month: "asc" }, { sortOrder: "asc" }],
  });
}

/** One table of planned work: each row is either a brand's festival or a one-off non-IP item. */
export async function getPlannedView(monthKey: string) {
  const [cohorts, festivals, entries] = await Promise.all([
    getCohorts(monthKey),
    getFestivals(),
    prisma.plannedEntry.findMany({ where: { monthKey }, include: { festival: true } }),
  ]);

  const rows = entries.map((e) => ({
    id: e.id,
    brandId: e.brandId,
    kind: e.kind,
    festivalId: e.festivalId,
    detail: e.kind === "FESTIVAL" ? (e.festival?.name ?? "") : (e.workLabel ?? ""),
    dateLabel: e.festival?.dateLabel ?? null,
    format: e.format,
    achieved: e.achieved,
    live: e.live,
  }));

  const sumBy = (kind: "FESTIVAL" | "NON_IP") =>
    rows.filter((r) => r.kind === kind).reduce((s, r) => ({ achieved: s.achieved + r.achieved, live: s.live + r.live }), { achieved: 0, live: 0 });

  return { cohorts, festivals, rows, festiveTotal: sumBy("FESTIVAL"), nonIpTotal: sumBy("NON_IP") };
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
