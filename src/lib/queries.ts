import { prisma } from "@/lib/prisma";
import { PersonRole, PieceKind, type PlanFormat } from "@/generated/prisma/enums";
import { currentMonthKey } from "@/lib/dates";

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

/** All logged REGULAR pieces for a month: each tap of "Log it", plus whether it's live. */
async function getPieces(monthKey: string) {
  return prisma.piece.findMany({
    where: { monthKey, kind: PieceKind.REGULAR },
    select: { brandId: true, ipId: true, live: true },
  });
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

/** Festive & Non-IP totals for the month (now just another kind of logged piece). */
export async function getFestiveNonIpTotals(monthKey: string) {
  const rows = await prisma.piece.findMany({
    where: { monthKey, kind: { in: [PieceKind.FESTIVAL, PieceKind.NON_IP] } },
    select: { kind: true, live: true },
  });
  const sumBy = (kind: PieceKind) => {
    const mine = rows.filter((r) => r.kind === kind);
    return { achieved: mine.length, live: mine.filter((r) => r.live).length };
  };
  return { festive: sumBy(PieceKind.FESTIVAL), nonIp: sumBy(PieceKind.NON_IP) };
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

/** Combines a month's set targets with its logged-piece counts into one brand+IP cell map. */
function buildCellMap(
  targets: { brandId: string; ipId: string; target: number }[],
  pieces: { brandId: string; ipId: string | null; live: boolean }[],
) {
  const cellMap = new Map<string, Cell>();
  for (const t of targets) {
    cellMap.set(`${t.brandId}:${t.ipId}`, { target: t.target, achieved: 0, live: 0 });
  }
  for (const p of pieces) {
    if (!p.ipId) continue;
    const key = `${p.brandId}:${p.ipId}`;
    const cell = cellMap.get(key) ?? { target: 0, achieved: 0, live: 0 };
    cell.achieved += 1;
    if (p.live) cell.live += 1;
    cellMap.set(key, cell);
  }
  return cellMap;
}

/** The full brand × IP read view, for the Dashboard's drill-down table. */
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

/* ---------------- LOG IT (the one input surface) ---------------- */

export type PlannedRow = {
  brandId: string;
  kind: "FESTIVAL" | "NON_IP";
  detail: string;
  label: string;
  format: PlanFormat;
  achieved: number;
  live: number;
};

/** Festive & Non-IP pieces for a set of brands, grouped into rows with achieved/live counts. */
async function getPlannedRows(brandIds: string[], monthKey: string): Promise<PlannedRow[]> {
  if (brandIds.length === 0) return [];
  const [festivals, pieces] = await Promise.all([
    getFestivals(),
    prisma.piece.findMany({
      where: { monthKey, brandId: { in: brandIds }, kind: { in: [PieceKind.FESTIVAL, PieceKind.NON_IP] } },
      select: { brandId: true, kind: true, festivalId: true, workLabel: true, format: true, live: true },
    }),
  ]);
  const festivalName = new Map(festivals.map((f) => [f.id, f.name]));
  const groups = new Map<string, PlannedRow>();
  for (const p of pieces) {
    const kind = p.kind === PieceKind.FESTIVAL ? "FESTIVAL" : "NON_IP";
    const detail = kind === "FESTIVAL" ? (p.festivalId ?? "") : (p.workLabel ?? "");
    const format = p.format!;
    const key = `${p.brandId}:${kind}:${detail}:${format}`;
    const label = kind === "FESTIVAL" ? (festivalName.get(detail) ?? detail) : detail;
    const row = groups.get(key) ?? { brandId: p.brandId, kind, detail, label, format, achieved: 0, live: 0 };
    row.achieved += 1;
    if (p.live) row.live += 1;
    groups.set(key, row);
  }
  return Array.from(groups.values());
}

/**
 * The cohort-leader "Log it" view: their own brands × their cohort's fixed
 * IPs (target + achieved + live), plus each brand's Festive/Non-IP pieces.
 * Pass "all" for admins, who can log for any cohort.
 */
export async function getLogItCohortView(cohortIds: string[] | "all", monthKey: string) {
  const cohorts = await prisma.cohort.findMany({
    where: cohortIds === "all" ? {} : { id: { in: cohortIds } },
    orderBy: { code: "asc" },
    include: {
      brands: { where: activeIn(monthKey), orderBy: { name: "asc" } },
      ips: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
  const brandIds = cohorts.flatMap((c) => c.brands.map((b) => b.id));
  const [targets, pieces, planned] = await Promise.all([
    prisma.brandIpMonth.findMany({ where: { monthKey, brandId: { in: brandIds } }, select: { brandId: true, ipId: true, target: true } }),
    prisma.piece.findMany({ where: { monthKey, brandId: { in: brandIds }, kind: PieceKind.REGULAR }, select: { brandId: true, ipId: true, live: true } }),
    getPlannedRows(brandIds, monthKey),
  ]);
  const cellMap = buildCellMap(targets, pieces);
  return {
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      code: cohort.code,
      leaderName: cohort.leaderName,
      ips: cohort.ips,
      brands: cohort.brands.map((b) => ({
        id: b.id,
        name: b.name,
        planned: planned.filter((p) => p.brandId === b.id),
      })),
    })),
    cellMap,
  };
}

/** The IP CS "Log it" view: their own IP(s) × the brands of the cohorts fixed to them. No target editing, no Festive/Non-IP. */
export async function getLogItIpView(ipIds: string[], monthKey: string) {
  if (ipIds.length === 0) return [];
  const [ips, pieces, targets] = await Promise.all([
    prisma.ip.findMany({
      where: { id: { in: ipIds } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { cohorts: { include: { brands: { where: activeIn(monthKey), orderBy: { name: "asc" } } } } },
    }),
    prisma.piece.findMany({ where: { monthKey, ipId: { in: ipIds }, kind: PieceKind.REGULAR }, select: { brandId: true, ipId: true, live: true } }),
    prisma.brandIpMonth.findMany({ where: { monthKey, ipId: { in: ipIds } }, select: { brandId: true, ipId: true, target: true } }),
  ]);
  return ips.map((ip) => {
    const brands = ip.cohorts.flatMap((c) => c.brands.map((b) => ({ brandId: b.id, brandName: b.name, cohortCode: c.code })));
    return {
      ip: { id: ip.id, name: ip.name },
      brands: brands.map((b) => {
        const mine = pieces.filter((p) => p.ipId === ip.id && p.brandId === b.brandId);
        const target = targets.find((t) => t.ipId === ip.id && t.brandId === b.brandId)?.target ?? 0;
        return { ...b, target, achieved: mine.length, live: mine.filter((p) => p.live).length };
      }),
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
