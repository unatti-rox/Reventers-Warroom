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

/** Each cohort's IP delivery for the month, from the Brand × IP matrix. */
export async function getCohortOverview(monthKey: string) {
  const [cohorts, cells] = await Promise.all([
    getCohorts(monthKey),
    prisma.brandIpMonth.findMany({ where: { monthKey }, select: { brandId: true, target: true, achieved: true, live: true } }),
  ]);
  return cohorts.map((cohort) => {
    const brandIds = new Set(cohort.brands.map((b) => b.id));
    const mine = cells.filter((c) => brandIds.has(c.brandId));
    const target = mine.reduce((s, c) => s + c.target, 0);
    const achieved = mine.reduce((s, c) => s + c.achieved, 0);
    const live = mine.reduce((s, c) => s + c.live, 0);
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

/** Each IP's delivery for the month, from the Brand × IP matrix. */
export async function getIpOverview(monthKey: string) {
  const [ips, cells] = await Promise.all([
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brandIpMonth.findMany({ where: { monthKey }, select: { ipId: true, target: true, achieved: true, live: true } }),
  ]);
  return ips.map((ip) => {
    const mine = cells.filter((c) => c.ipId === ip.id);
    const target = mine.reduce((s, c) => s + c.target, 0);
    const achieved = mine.reduce((s, c) => s + c.achieved, 0);
    const live = mine.reduce((s, c) => s + c.live, 0);
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
  const [ips, allBrands, cells] = await Promise.all([
    prisma.ip.findMany({ where: { id: { in: ipIds } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brand.findMany({ where: activeIn(monthKey), orderBy: { name: "asc" }, include: { cohort: true } }),
    prisma.brandIpMonth.findMany({ where: { monthKey, ipId: { in: ipIds } } }),
  ]);
  return Promise.all(
    ips.map(async (ip) => {
      const cohortIds = await getIpAssignedCohortIds(ip.id, monthKey, week);
      const brands = allBrands.filter((b) => cohortIds.has(b.cohortId));
      return {
        ip,
        brands: brands.map((brand) => {
          const cell = cells.find((c) => c.ipId === ip.id && c.brandId === brand.id);
          return {
            brandId: brand.id,
            brandName: brand.name,
            cohortCode: brand.cohort.code,
            achieved: cell?.achieved ?? 0,
            live: cell?.live ?? 0,
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

/** A cohort leader's own brands (across cohorts they lead), for the simple "My Brands" page. */
export async function getMyTargetBrands(cohortIds: string[], monthKey: string) {
  if (cohortIds.length === 0) return { brands: [], ips: [], cellMap: new Map<string, { target: number; achieved: number; live: number }>() };
  const [cohorts, ips, cells] = await Promise.all([
    prisma.cohort.findMany({
      where: { id: { in: cohortIds } },
      orderBy: { code: "asc" },
      include: { brands: { where: activeIn(monthKey), orderBy: { name: "asc" } } },
    }),
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brandIpMonth.findMany({
      where: { monthKey, brand: { cohortId: { in: cohortIds } } },
      select: { brandId: true, ipId: true, target: true, achieved: true, live: true },
    }),
  ]);
  const brands = cohorts.flatMap((c) => c.brands.map((b) => ({ id: b.id, name: b.name, cohortCode: c.code })));
  const cellMap = new Map(cells.map((c) => [`${c.brandId}:${c.ipId}`, c]));
  return { brands, ips, cellMap, multiCohort: cohorts.length > 1 };
}

export async function getMatrix(monthKey: string) {
  const [cohorts, ips, cells] = await Promise.all([
    getCohorts(monthKey),
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.brandIpMonth.findMany({ where: { monthKey } }),
  ]);
  const cellMap = new Map(cells.map((c) => [`${c.brandId}:${c.ipId}`, c]));
  return { cohorts, ips, cellMap };
}

export async function getRotationView(monthKey: string) {
  await getOrCreateCycle(monthKey);
  const [cycle, teams, cohorts, ipMonth] = await Promise.all([
    prisma.rotationCycle.findUniqueOrThrow({
      where: { monthKey },
      include: { entries: { include: { assignments: true } }, trades: true },
    }),
    getIpTeams(),
    prisma.cohort.findMany({ orderBy: { code: "asc" } }),
    prisma.brandIpMonth.groupBy({ by: ["ipId"], where: { monthKey }, _sum: { achieved: true, live: true } }),
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
    const sums = ipMonth.find((m) => m.ipId === team.id)?._sum;
    return { team, byWeek, monthTarget, achieved: sums?.achieved ?? 0, live: sums?.live ?? 0 };
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
    prisma.cohort.findMany({ orderBy: { code: "asc" } }),
    prisma.ip.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.shoot.findMany({ where: { date: { startsWith: monthKey } }, orderBy: { date: "asc" }, include: { ip: true } }),
  ]);
  return { cohorts, ips, shoots };
}
