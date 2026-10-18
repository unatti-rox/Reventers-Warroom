import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  cohortSeed,
  ipSeed,
  floaterSeed,
  adminSeed,
  adminSetupCodeHashes,
  festivalSeed,
  BASE_MONTHLY_TARGET,
  PER_BRAND_INCREMENT,
} from "./seed-data";

// Loads the launch data exactly once. It runs on every deploy (see
// scripts/seed-once.mjs), but after the first successful run the
// "seed.version" marker makes it a no-op, so edits made in the app are
// never overwritten.
const SEED_VERSION = "2";

function isLocalHost(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

// See src/lib/prisma.ts for why sslmode has to be stripped rather than
// just passing a sibling `ssl` option.
function connectionConfig(raw: string | undefined) {
  if (!raw) return { connectionString: raw };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { connectionString: raw };
  }
  if (isLocalHost(url)) return { connectionString: raw };

  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

const adapter = new PrismaPg(connectionConfig(process.env.DIRECT_URL || process.env.DATABASE_URL));
const prisma = new PrismaClient({ adapter });

const WEEKS = ["W1", "W2", "W3", "W4"] as const;

/** The admins' chosen passwords (scrypt hashes). */
const ISHIKA_PASSWORD_HASH = "scrypt$6JUy5_1jha5DI6-DUV9XYw$lkmP7_cL-gQufU7KTR1zvlpBHHlBgsMUJxECX8rP8ISMQvOwPifdicn4QvD4A23iKjY6SOMM-jTl1hhqu2oN8w";
const UNNATI_PASSWORD_HASH = "scrypt$2AvLUaCHtJ8__k6uKJ3OpQ$W8JylPnZH3jUHoH9bUePBdj29twNbHbOZD777JHCtohIqHHqjcXCthhN0g_cX1GwEMNu7p2aFvPHpbU1tNU4CA";

function currentMonthKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}`;
}

async function person(name: string, appRole: "ADMIN" | "COHORT_LEADER" | "IP_CS" | "DESIGNER" | "EDITOR" | "FLOATER") {
  return prisma.person.upsert({ where: { name }, update: {}, create: { name, appRole } });
}

async function main() {
  const marker = await prisma.appSetting.findUnique({ where: { key: "seed.version" } });
  if (marker) {
    console.log(`Launch data already loaded (seed v${marker.value}); nothing to do.`);
  } else {
    await loadLaunchData();
  }
  await applyAccountSetup();
  await applyCohortRealignment();
  await applyTeamChanges();
  await applyShradhaRestoration();
  await applyShradhaCorrection();
  await applyShradhaRotationSlot();
}

/**
 * One-time admin logins requested by the admins. Runs once (tracked by its
 * own marker), so a password changed later in the app is never undone.
 */
const ADMIN_LOGINS = [
  { name: "Ishika", email: "ishika@insomniacs.in", passwordHash: ISHIKA_PASSWORD_HASH },
  { name: "Unnati", email: "unatti@insomniacs.in", passwordHash: UNNATI_PASSWORD_HASH },
];

async function applyAccountSetup() {
  const key = "setup.admin-logins.v1";
  if (await prisma.appSetting.findUnique({ where: { key } })) return;
  for (const a of ADMIN_LOGINS) {
    const person = await prisma.person.findUnique({ where: { name: a.name } });
    if (!person) throw new Error(`Admin ${a.name} not found`);
    await prisma.person.update({
      where: { id: person.id },
      data: { email: a.email, passwordHash: a.passwordHash, mustChangePassword: false, active: true, appRole: "ADMIN" },
    });
    await prisma.session.deleteMany({ where: { personId: person.id } });
  }
  await prisma.appSetting.create({ data: { key, value: new Date().toISOString() } });
  console.log("Admin logins set up.");
}

/**
 * One-time portfolio realignment (Oct 2026): Pooja and Shradha are off the
 * team, C8 is new (Ishika & Unnati's own cohort), and client portfolios
 * moved around. Runs once (tracked by its own marker). Rotation assignments
 * are untouched: they're keyed by cohortId, and C1-C7 keep their ids, so
 * each cohort's existing weekly IP slot carries over automatically under
 * its new leader. C8 is new and starts with no weekly rotation slot — an
 * admin has to assign it on the Weekly Rotation page.
 *
 * Existing leaders keep their Person record (and login) unchanged; only
 * Cohort.leaderName (a display string, decoupled from Person.name here) is
 * updated to their full name, so nobody's sign-in name changes underneath
 * them.
 */
async function applyCohortRealignment() {
  const key = "cohort-realignment.2026-10";
  if (await prisma.appSetting.findUnique({ where: { key } })) return;

  async function findBrand(name: string) {
    const b = await prisma.brand.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (!b) throw new Error(`Cohort realignment: brand not found: ${name}`);
    return b;
  }
  const cohortByCode = (code: string) => prisma.cohort.findUniqueOrThrow({ where: { code } });

  const monthKey = currentMonthKey();

  // Fix casing to match the current portfolio list.
  const savvyGreens = await findBrand("Savvy greens");
  await prisma.brand.update({ where: { id: savvyGreens.id }, data: { name: "Savvy Greens" } });

  // New cohort leaders.
  const abhishek = await person("Abhishek Gosavi", "COHORT_LEADER");
  const parin = await person("Parin Mehta", "COHORT_LEADER");

  // Leadership handoffs and display-name updates for cohorts that keep their id.
  const c1 = await cohortByCode("C1");
  await prisma.cohort.update({ where: { id: c1.id }, data: { leaderName: "Aasawari Dalvi" } });
  const c2 = await cohortByCode("C2");
  await prisma.cohort.update({ where: { id: c2.id }, data: { leaderName: "Abhishek Gosavi", leaderPersonId: abhishek.id } });
  const c3 = await cohortByCode("C3");
  await prisma.cohort.update({ where: { id: c3.id }, data: { leaderName: "Parin Mehta", leaderPersonId: parin.id } });
  const c4 = await cohortByCode("C4");
  await prisma.cohort.update({ where: { id: c4.id }, data: { leaderName: "Shilpa Chawla" } });
  const c5 = await cohortByCode("C5");
  await prisma.cohort.update({ where: { id: c5.id }, data: { leaderName: "Harsh Devani" } });
  const c7 = await cohortByCode("C7");
  await prisma.cohort.update({ where: { id: c7.id }, data: { leaderName: "Yoshita Dhandhay" } });
  // C6 (Karan Sharma) is unchanged.

  // New cohort for the admins' own portfolio. Both are already admins (full
  // access everywhere), so no single leaderPersonId is set here.
  const c8 = await prisma.cohort.upsert({
    where: { code: "C8" },
    update: {},
    create: { code: "C8", leaderName: "Ishika & Unatti" },
  });

  // Brands that moved to a different cohort.
  const moves: [string, string][] = [
    ["Hiranandani", "C8"],
    ["Regalia", "C8"],
    ["Raymond", "C8"],
    ["Sajay", "C5"],
    ["Divyashree", "C3"],
    ["Vaibhavlaxmi", "C3"],
    ["Sibermond", "C3"],
  ];
  for (const [brandName, code] of moves) {
    const brand = await findBrand(brandName);
    const cohort = await cohortByCode(code);
    await prisma.brand.update({ where: { id: brand.id }, data: { cohortId: cohort.id } });
  }

  // Brand-new clients.
  await prisma.brand.create({ data: { name: "Vaayu", cohortId: c8.id, addedMonthKey: monthKey } });
  await prisma.brand.create({ data: { name: "Dharti", cohortId: c5.id, addedMonthKey: monthKey } });

  // Clients no longer on any cohort leader's portfolio.
  const archivedBrands = [
    "RnY",
    "Fortune Primero",
    "Viera",
    "IMB",
    "Nexsa",
    "Perspective",
    "GHP",
    "TRL",
    "Ramsons Trendsquares",
    "Trendsquares WOG",
    "GVP",
  ];
  for (const name of archivedBrands) {
    const brand = await findBrand(name);
    await prisma.brand.update({ where: { id: brand.id }, data: { archivedMonthKey: monthKey } });
  }

  // Off the team.
  for (const name of ["Pooja", "Shradha"]) {
    const p = await prisma.person.findUnique({ where: { name } });
    if (p) await prisma.person.update({ where: { id: p.id }, data: { active: false } });
  }

  await prisma.appSetting.create({ data: { key, value: new Date().toISOString() } });
  console.log("Cohort realignment (Oct 2026) applied.");
}

/**
 * One-time team change (Oct 2026): Adarsh (IP CS) and Sameer (editor) are
 * off the team. Rishika moves off Photoshoot Model and AI Walkthrough |
 * Explainer (now Muskaan alone) onto Connectivity & Infrastructure, taking
 * Adarsh's spot there. Aditya Bhosle replaces Sameer as that IP's editor.
 * Runs once (tracked by its own marker).
 */
async function applyTeamChanges() {
  const key = "team-changes.2026-10";
  if (await prisma.appSetting.findUnique({ where: { key } })) return;

  const connectivity = await prisma.ip.findUniqueOrThrow({ where: { name: "Connectivity & Infrastructure" } });
  const photoshoot = await prisma.ip.findUniqueOrThrow({ where: { name: "Photoshoot Model" } });
  const aiWalkthrough = await prisma.ip.findUniqueOrThrow({ where: { name: "AI Walkthrough | Explainer" } });

  const rishika = await prisma.person.findUniqueOrThrow({ where: { name: "Rishika" } });
  const adarsh = await prisma.person.findUniqueOrThrow({ where: { name: "Adarsh" } });
  const sameer = await prisma.person.findUniqueOrThrow({ where: { name: "Sameer" } });

  // Rishika: off Photoshoot Model and AI Walkthrough, onto Connectivity & Infrastructure.
  await prisma.personAssignment.deleteMany({ where: { personId: rishika.id, ipId: photoshoot.id, role: "IP_CS" } });
  await prisma.personAssignment.deleteMany({ where: { personId: rishika.id, ipId: aiWalkthrough.id, role: "IP_CS" } });
  await prisma.personAssignment.upsert({
    where: { personId_ipId_role: { personId: rishika.id, ipId: connectivity.id, role: "IP_CS" } },
    update: {},
    create: { personId: rishika.id, ipId: connectivity.id, role: "IP_CS" },
  });

  // Adarsh and Sameer are off the team.
  await prisma.personAssignment.deleteMany({ where: { personId: adarsh.id, ipId: connectivity.id, role: "IP_CS" } });
  await prisma.personAssignment.deleteMany({ where: { personId: sameer.id, ipId: connectivity.id, role: "EDITOR" } });
  await prisma.person.update({ where: { id: adarsh.id }, data: { active: false } });
  await prisma.person.update({ where: { id: sameer.id }, data: { active: false } });

  // Aditya Bhosle replaces Sameer as editor.
  const aditya = await person("Aditya Bhosle", "EDITOR");
  await prisma.personAssignment.upsert({
    where: { personId_ipId_role: { personId: aditya.id, ipId: connectivity.id, role: "EDITOR" } },
    update: {},
    create: { personId: aditya.id, ipId: connectivity.id, role: "EDITOR" },
  });

  await prisma.appSetting.create({ data: { key, value: new Date().toISOString() } });
  console.log("Team changes (Oct 2026) applied.");
}

/**
 * Shradha is back. The cohort realignment above gave her old C3 to Parin
 * Mehta (keeping Aakshya, per the Oct 2026 portfolio list), so Shradha gets
 * a fresh cohort (C9) with the rest of her old brands restored from
 * archive. Like C8, C9 starts with no weekly rotation slot - an admin has
 * to assign it. Runs once (tracked by its own marker).
 */
async function applyShradhaRestoration() {
  const key = "shradha-restoration.2026-10";
  if (await prisma.appSetting.findUnique({ where: { key } })) return;

  const shradha = await prisma.person.findUniqueOrThrow({ where: { name: "Shradha" } });
  await prisma.person.update({ where: { id: shradha.id }, data: { active: true } });

  const c9 = await prisma.cohort.upsert({
    where: { code: "C9" },
    update: {},
    create: { code: "C9", leaderName: "Shradha", leaderPersonId: shradha.id },
  });

  const brandNames = ["Fortune Primero", "Viera", "IMB", "Nexsa", "Perspective", "GHP", "TRL", "Ramsons Trendsquares"];
  for (const name of brandNames) {
    const brand = await prisma.brand.findFirstOrThrow({ where: { name: { equals: name, mode: "insensitive" } } });
    await prisma.brand.update({ where: { id: brand.id }, data: { cohortId: c9.id, archivedMonthKey: null } });
  }

  await prisma.appSetting.create({ data: { key, value: new Date().toISOString() } });
  console.log("Shradha restored as C9 (Oct 2026).");
}

/**
 * Correction to the restoration above: Shradha's actual portfolio is 7
 * brands, not 8 - Nexsa was included by mistake and goes back to archived.
 * Also fills in her full name for C9's display. Runs once (tracked by its
 * own marker).
 */
async function applyShradhaCorrection() {
  const key = "shradha-correction.2026-10";
  if (await prisma.appSetting.findUnique({ where: { key } })) return;

  const c9 = await prisma.cohort.findUniqueOrThrow({ where: { code: "C9" } });
  await prisma.cohort.update({ where: { id: c9.id }, data: { leaderName: "Shradha Patani" } });

  const nexsa = await prisma.brand.findFirstOrThrow({ where: { name: { equals: "Nexsa", mode: "insensitive" } } });
  await prisma.brand.update({ where: { id: nexsa.id }, data: { archivedMonthKey: currentMonthKey() } });

  await prisma.appSetting.create({ data: { key, value: new Date().toISOString() } });
  console.log("Shradha correction (Oct 2026) applied.");
}

/**
 * C9 (Shradha) is brand new, so it never appears in any week's rotation
 * yet. Per instruction, she's paired with C1 (Aasawari) wherever Aasawari
 * is assigned: adds a RotationAssignment for C9 on every entry in this
 * month's cycle that already has C1. Future months clone this cycle's
 * assignments forward (see getOrCreateCycle), so the pairing persists
 * automatically. Runs once (tracked by its own marker).
 */
async function applyShradhaRotationSlot() {
  const key = "shradha-rotation-slot.2026-10";
  if (await prisma.appSetting.findUnique({ where: { key } })) return;

  const c1 = await prisma.cohort.findUniqueOrThrow({ where: { code: "C1" } });
  const c9 = await prisma.cohort.findUniqueOrThrow({ where: { code: "C9" } });
  const monthKey = currentMonthKey();

  const cycle = await prisma.rotationCycle.findUnique({
    where: { monthKey },
    include: { entries: { include: { assignments: true } } },
  });
  if (cycle) {
    for (const entry of cycle.entries) {
      const hasC1 = entry.assignments.some((a) => a.cohortId === c1.id);
      const hasC9 = entry.assignments.some((a) => a.cohortId === c9.id);
      if (hasC1 && !hasC9) {
        await prisma.rotationAssignment.create({ data: { entryId: entry.id, cohortId: c9.id } });
      }
    }
  }

  await prisma.appSetting.create({ data: { key, value: new Date().toISOString() } });
  console.log("Shradha paired with Aasawari in the weekly rotation (Oct 2026).");
}

async function loadLaunchData() {

  console.log("Loading settings...");
  for (const [key, value] of [
    ["target.baseMonthly", String(BASE_MONTHLY_TARGET)],
    ["target.perBrand", String(PER_BRAND_INCREMENT)],
  ]) {
    await prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log("Loading admins...");
  for (const name of adminSeed) {
    await prisma.person.upsert({
      where: { name },
      update: {},
      create: { name, appRole: "ADMIN", passwordHash: adminSetupCodeHashes[name], mustChangePassword: true },
    });
  }

  console.log("Loading cohorts + brands...");
  for (const c of cohortSeed) {
    const leader = await person(c.leaderName, "COHORT_LEADER");
    const cohort = await prisma.cohort.upsert({
      where: { code: c.code },
      update: { leaderName: c.leaderName, leaderPersonId: leader.id },
      create: { code: c.code, leaderName: c.leaderName, leaderPersonId: leader.id },
    });
    for (const name of c.brands) {
      await prisma.brand.upsert({
        where: { cohortId_name: { cohortId: cohort.id, name } },
        update: {},
        create: { name, cohortId: cohort.id },
      });
    }
  }

  console.log("Loading IPs + teams...");
  for (const [i, ip] of ipSeed.entries()) {
    const record = await prisma.ip.upsert({
      where: { name: ip.name },
      update: { defaultWeeklyTarget: ip.weeklyTarget, sortOrder: i + 1 },
      create: { name: ip.name, defaultWeeklyTarget: ip.weeklyTarget, sortOrder: i + 1 },
    });
    const roles = [
      ...ip.ipcs.map((name) => ({ name, role: "IP_CS" as const })),
      ...ip.designers.map((name) => ({ name, role: "DESIGNER" as const })),
      ...ip.editors.map((name) => ({ name, role: "EDITOR" as const })),
    ];
    for (const r of roles) {
      const p = await person(r.name, r.role);
      await prisma.personAssignment.upsert({
        where: { personId_ipId_role: { personId: p.id, ipId: record.id, role: r.role } },
        update: {},
        create: { personId: p.id, ipId: record.id, role: r.role },
      });
    }
  }
  for (const name of floaterSeed) await person(name, "FLOATER");

  console.log("Loading this month's rotation...");
  const cohorts = await prisma.cohort.findMany();
  const cohortIdByLeader = new Map(cohorts.map((c) => [c.leaderName, c.id]));
  const monthKey = currentMonthKey();
  const cycle = await prisma.rotationCycle.upsert({ where: { monthKey }, update: {}, create: { monthKey } });
  for (const ip of ipSeed) {
    const record = await prisma.ip.findUniqueOrThrow({ where: { name: ip.name } });
    for (const [w, week] of WEEKS.entries()) {
      const entry = await prisma.rotationEntry.upsert({
        where: { cycleId_ipId_week: { cycleId: cycle.id, ipId: record.id, week } },
        update: { target: ip.weeklyTarget },
        create: { cycleId: cycle.id, ipId: record.id, week, target: ip.weeklyTarget },
      });
      for (const leader of ip.rotation[w]) {
        const cohortId = cohortIdByLeader.get(leader);
        if (!cohortId) throw new Error(`Rotation names unknown cohort leader "${leader}"`);
        await prisma.rotationAssignment.upsert({
          where: { entryId_cohortId: { entryId: entry.id, cohortId } },
          update: {},
          create: { entryId: entry.id, cohortId },
        });
      }
    }
  }

  console.log("Loading festivals...");
  if ((await prisma.festival.count()) === 0) {
    await prisma.festival.createMany({
      data: festivalSeed.map(([month, dateLabel, name], i) => ({ month, dateLabel, name, sortOrder: i })),
    });
  }

  await prisma.appSetting.create({ data: { key: "seed.version", value: SEED_VERSION } });
  console.log("Launch data loaded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
