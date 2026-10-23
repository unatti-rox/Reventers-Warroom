"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actionAdmin, actionUser, createSession, destroySession, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { hashPassword, temporaryPassword, verifyPassword } from "@/lib/password";
import { currentMonthKey } from "@/lib/dates";
import { AppRole, PersonRole, PlanFormat, PieceKind } from "@/generated/prisma/enums";

/** Actions return a message instead of throwing: production builds hide thrown error text. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

class Refused extends Error {}

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, error: e.message };
    if (e instanceof Error && /sign in again|Only admins/.test(e.message)) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function refuse(message: string): never {
  throw new Refused(message);
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function checkMonth(monthKey: string) {
  if (!MONTH.test(monthKey)) refuse("Invalid month.");
}

function count(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100000) refuse("Enter a number of 0 or more.");
  return Math.round(value);
}

function text(value: unknown, what: string, max = 120) {
  const s = String(value ?? "").trim();
  if (!s) refuse(`Enter ${what}.`);
  if (s.length > max) refuse(`${what[0].toUpperCase() + what.slice(1)} is too long.`);
  return s;
}

async function brandCohortId(brandId: string) {
  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { cohortId: true } });
  if (!brand) refuse("That brand no longer exists.");
  return brand.cohortId;
}

async function assertLeadsBrand(user: CurrentUser, brandId: string) {
  if (user.isAdmin) return;
  const cohortId = await brandCohortId(brandId);
  if (!user.cohortIds.includes(cohortId)) refuse("You can only edit your own cohort's brands.");
}

function assertLeadsCohort(user: CurrentUser, cohortId: string) {
  if (user.isAdmin) return;
  if (!user.cohortIds.includes(cohortId)) refuse("You can only edit your own cohort's shoots.");
}

/* ---------------- ACCOUNT ---------------- */

export async function signIn(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const login = String(form.get("login") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!login || !password) return { ok: false, error: "Enter your name or email and your password." };

  const person = await prisma.person.findFirst({
    where: {
      active: true,
      OR: [{ name: { equals: login, mode: "insensitive" } }, { email: { equals: login.toLowerCase() } }],
    },
  });
  if (!person || !verifyPassword(password, person.passwordHash)) {
    return { ok: false, error: "That name/email and password don't match. Ask an admin if you need a new password." };
  }
  await createSession(person.id);
  redirect(person.mustChangePassword ? "/account/password" : "/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next.length < 8) return { ok: false, error: "Use at least 8 characters." };
  if (next !== confirm) return { ok: false, error: "The two passwords don't match." };
  await prisma.person.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next), mustChangePassword: false } });
  redirect("/");
}

/* ---------------- BRAND × IP MATRIX ---------------- */

/** True once an admin has fixed this IP to this brand's cohort (set in Admin → Cohorts & Brands). */
async function assertIpPairedWithBrand(brandId: string, ipId: string) {
  const cohortId = await brandCohortId(brandId);
  const paired = await prisma.cohort.findFirst({ where: { id: cohortId, ips: { some: { id: ipId } } } });
  if (!paired) refuse("This IP isn't paired with that brand's cohort yet — set that in Admin.");
}

export async function setBrandIpTarget(monthKey: string, brandId: string, ipId: string, value: number) {
  return run(async () => {
    const user = await actionUser();
    checkMonth(monthKey);
    const v = count(value);
    if (!user.isAdmin) {
      const cohortId = await brandCohortId(brandId);
      if (!user.cohortIds.includes(cohortId)) refuse("Only this brand's cohort leader sets its targets.");
    }
    await assertIpPairedWithBrand(brandId, ipId);
    await prisma.brandIpMonth.upsert({
      where: { monthKey_brandId_ipId: { monthKey, brandId, ipId } },
      update: { target: v },
      create: { monthKey, brandId, ipId, target: v },
    });
  });
}

async function assertCanLogPiece(user: CurrentUser, brandId: string, ipId: string) {
  if (user.isAdmin) return;
  const cohortId = await brandCohortId(brandId);
  if (user.cohortIds.includes(cohortId) || user.ipcsIpIds.includes(ipId)) return;
  refuse("Only this brand's cohort leader or the IP's IP CS can log it.");
}

/** The core "Log it" action: one piece of IP content, made just now. No numbers to type. */
export async function logPiece(monthKey: string, brandId: string, ipId: string) {
  return run(async () => {
    const user = await actionUser();
    checkMonth(monthKey);
    await assertCanLogPiece(user, brandId, ipId);
    await assertIpPairedWithBrand(brandId, ipId);
    await prisma.piece.create({ data: { monthKey, brandId, ipId, kind: PieceKind.REGULAR, loggedById: user.id } });
  });
}

/** Marks the oldest not-yet-live piece for this brand + IP + month as live. */
export async function markOneLive(monthKey: string, brandId: string, ipId: string) {
  return run(async () => {
    const user = await actionUser();
    await assertCanLogPiece(user, brandId, ipId);
    const piece = await prisma.piece.findFirst({
      where: { monthKey, brandId, ipId, kind: PieceKind.REGULAR, live: false },
      orderBy: { createdAt: "asc" },
    });
    if (!piece) refuse("Nothing logged yet to mark live.");
    await prisma.piece.update({ where: { id: piece.id }, data: { live: true } });
  });
}

/** Removes the most recently logged piece for this brand + IP + month - for fixing an accidental tap. */
export async function undoLastPiece(monthKey: string, brandId: string, ipId: string) {
  return run(async () => {
    const user = await actionUser();
    await assertCanLogPiece(user, brandId, ipId);
    const piece = await prisma.piece.findFirst({ where: { monthKey, brandId, ipId, kind: PieceKind.REGULAR }, orderBy: { createdAt: "desc" } });
    if (!piece) refuse("Nothing to undo.");
    await prisma.piece.delete({ where: { id: piece.id } });
  });
}

/* ---------------- FESTIVE & NON-IP (logged the same way, into the same Piece log) ---------------- */

function plannedWhere(kind: "FESTIVAL" | "NON_IP", detail: string) {
  return kind === "FESTIVAL" ? { festivalId: detail } : { workLabel: detail };
}

/** `detail` is a festival id for FESTIVAL, or a free-text label (e.g. "Teaser reel") for NON_IP. */
export async function logPlannedPiece(monthKey: string, brandId: string, kind: "FESTIVAL" | "NON_IP", detail: string, format: PlanFormat) {
  return run(async () => {
    const user = await actionUser();
    checkMonth(monthKey);
    await assertLeadsBrand(user, brandId);
    if (kind === "FESTIVAL") {
      if (!(await prisma.festival.findUnique({ where: { id: detail } }))) refuse("Pick a festival.");
      await prisma.piece.create({ data: { monthKey, brandId, kind: PieceKind.FESTIVAL, festivalId: detail, format, loggedById: user.id } });
    } else {
      const workLabel = text(detail, "the non-IP work");
      await prisma.piece.create({ data: { monthKey, brandId, kind: PieceKind.NON_IP, workLabel, format, loggedById: user.id } });
    }
  });
}

export async function markPlannedLive(monthKey: string, brandId: string, kind: "FESTIVAL" | "NON_IP", detail: string, format: PlanFormat) {
  return run(async () => {
    const user = await actionUser();
    await assertLeadsBrand(user, brandId);
    const piece = await prisma.piece.findFirst({
      where: { monthKey, brandId, kind: kind === "FESTIVAL" ? PieceKind.FESTIVAL : PieceKind.NON_IP, format, live: false, ...plannedWhere(kind, detail) },
      orderBy: { createdAt: "asc" },
    });
    if (!piece) refuse("Nothing logged yet to mark live.");
    await prisma.piece.update({ where: { id: piece.id }, data: { live: true } });
  });
}

export async function undoPlannedPiece(monthKey: string, brandId: string, kind: "FESTIVAL" | "NON_IP", detail: string, format: PlanFormat) {
  return run(async () => {
    const user = await actionUser();
    await assertLeadsBrand(user, brandId);
    const piece = await prisma.piece.findFirst({
      where: { monthKey, brandId, kind: kind === "FESTIVAL" ? PieceKind.FESTIVAL : PieceKind.NON_IP, format, ...plannedWhere(kind, detail) },
      orderBy: { createdAt: "desc" },
    });
    if (!piece) refuse("Nothing to undo.");
    await prisma.piece.delete({ where: { id: piece.id } });
  });
}

/* ---------------- SHOOT SCHEDULE ---------------- */

export async function addShoot(cohortId: string, brandId: string, ipId: string, date: string, dop: string, socialMediaPerson: string, remarks: string) {
  return run(async () => {
    const user = await actionUser();
    assertLeadsCohort(user, cohortId);
    if (!DAY.test(date)) refuse("Pick a valid date.");
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand || brand.cohortId !== cohortId) refuse("Pick a brand from this cohort.");
    if (!(await prisma.ip.findUnique({ where: { id: ipId } }))) refuse("Pick an IP.");
    await prisma.shoot.create({
      data: {
        cohortId,
        brandId,
        ipId,
        date,
        dop: text(dop, "the DOP"),
        socialMediaPerson: text(socialMediaPerson, "the social media person"),
        remarks: String(remarks ?? "").trim().slice(0, 300),
      },
    });
  });
}

export async function updateShoot(shootId: string, field: "brandId" | "ipId" | "date" | "dop" | "socialMediaPerson" | "remarks", value: string) {
  return run(async () => {
    const user = await actionUser();
    const shoot = await prisma.shoot.findUnique({ where: { id: shootId } });
    if (!shoot) refuse("That shoot is already gone.");
    assertLeadsCohort(user, shoot.cohortId);
    let v: string;
    if (field === "date") {
      if (!DAY.test(value)) refuse("Pick a valid date.");
      v = value;
    } else if (field === "ipId") {
      if (!(await prisma.ip.findUnique({ where: { id: value } }))) refuse("Pick an IP.");
      v = value;
    } else if (field === "brandId") {
      const brand = await prisma.brand.findUnique({ where: { id: value } });
      if (!brand || brand.cohortId !== shoot.cohortId) refuse("Pick a brand from this cohort.");
      v = value;
    } else if (field === "remarks") {
      v = String(value ?? "").trim().slice(0, 300);
    } else {
      v = text(value, "that field");
    }
    await prisma.shoot.update({ where: { id: shootId }, data: { [field]: v } });
  });
}

export async function removeShoot(shootId: string) {
  return run(async () => {
    const user = await actionUser();
    const shoot = await prisma.shoot.findUnique({ where: { id: shootId } });
    if (!shoot) return;
    assertLeadsCohort(user, shoot.cohortId);
    await prisma.shoot.delete({ where: { id: shootId } });
  });
}

/* ---------------- ADMIN: TARGETS ---------------- */

export async function saveTargetSettings(baseMonthly: number, perBrand: number) {
  return run(async () => {
    await actionAdmin();
    for (const [key, value] of [
      ["target.baseMonthly", count(baseMonthly)],
      ["target.perBrand", count(perBrand)],
    ] as const) {
      await prisma.appSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }
  });
}

/** Set (or clear, with null) a month's base override and/or its entered achieved total. */
export async function saveMonthSetting(monthKey: string, field: "baseOverride" | "achievedOverride", value: number | null) {
  return run(async () => {
    await actionAdmin();
    checkMonth(monthKey);
    const v = value === null ? null : count(value);
    await prisma.monthSetting.upsert({
      where: { monthKey },
      update: { [field]: v },
      create: { monthKey, [field]: v },
    });
  });
}

/* ---------------- ADMIN: COHORTS & BRANDS ---------------- */

export async function addCohort(code: string, leaderPersonId: string) {
  return run(async () => {
    await actionAdmin();
    const c = text(code, "a cohort code", 12).toUpperCase();
    const leader = await prisma.person.findUnique({ where: { id: leaderPersonId } });
    if (!leader) refuse("Pick the cohort leader.");
    if (await prisma.cohort.findUnique({ where: { code: c } })) refuse(`${c} already exists.`);
    await prisma.cohort.create({ data: { code: c, leaderName: leader.name, leaderPersonId: leader.id } });
    if (leader.appRole !== "ADMIN") await prisma.person.update({ where: { id: leader.id }, data: { appRole: "COHORT_LEADER" } });
  });
}

export async function setCohortLeader(cohortId: string, personId: string) {
  return run(async () => {
    await actionAdmin();
    const leader = await prisma.person.findUnique({ where: { id: personId } });
    if (!leader) refuse("Pick the cohort leader.");
    await prisma.cohort.update({ where: { id: cohortId }, data: { leaderName: leader.name, leaderPersonId: leader.id } });
    if (leader.appRole !== "ADMIN") await prisma.person.update({ where: { id: leader.id }, data: { appRole: "COHORT_LEADER" } });
  });
}

/** Sets this cohort's fixed IPs (replaces the whole set) — no more weekly rotation to manage. */
export async function setCohortIps(cohortId: string, ipIds: string[]) {
  return run(async () => {
    await actionAdmin();
    await prisma.cohort.update({ where: { id: cohortId }, data: { ips: { set: ipIds.map((id) => ({ id })) } } });
  });
}

export async function addBrand(name: string, cohortId: string) {
  return run(async () => {
    await actionAdmin();
    const n = text(name, "a brand name");
    if (await prisma.brand.findFirst({ where: { name: { equals: n, mode: "insensitive" } } })) refuse(`${n} already exists.`);
    // Added after launch: from this month it adds to the IP base target.
    await prisma.brand.create({ data: { name: n, cohortId, addedMonthKey: currentMonthKey() } });
  });
}

export async function updateBrand(brandId: string, name: string, cohortId: string) {
  return run(async () => {
    await actionAdmin();
    const n = text(name, "a brand name");
    const clash = await prisma.brand.findFirst({ where: { name: { equals: n, mode: "insensitive" }, NOT: { id: brandId } } });
    if (clash) refuse(`${n} already exists.`);
    await prisma.brand.update({ where: { id: brandId }, data: { name: n, cohortId } });
  });
}

export async function setBrandArchived(brandId: string, archived: boolean) {
  return run(async () => {
    await actionAdmin();
    await prisma.brand.update({ where: { id: brandId }, data: { archivedMonthKey: archived ? currentMonthKey() : null } });
  });
}

/* ---------------- ADMIN: PEOPLE & IP TEAMS ---------------- */

const ROLES = Object.values(AppRole);

export async function addPerson(name: string, appRole: AppRole, email: string) {
  return run(async () => {
    await actionAdmin();
    const n = text(name, "a name", 80);
    if (!ROLES.includes(appRole)) refuse("Pick a role.");
    const e = email.trim().toLowerCase() || null;
    if (e && !/^\S+@\S+\.\S+$/.test(e)) refuse("Enter a valid email, or leave it empty.");
    if (await prisma.person.findFirst({ where: { name: { equals: n, mode: "insensitive" } } })) refuse(`${n} is already on the team.`);
    if (e && (await prisma.person.findUnique({ where: { email: e } }))) refuse("Someone already uses that email.");
    await prisma.person.create({ data: { name: n, appRole, email: e } });
  });
}

export async function updatePerson(personId: string, appRole: AppRole, email: string, active: boolean) {
  return run(async () => {
    const admin = await actionAdmin();
    if (!ROLES.includes(appRole)) refuse("Pick a role.");
    const e = email.trim().toLowerCase() || null;
    if (e && !/^\S+@\S+\.\S+$/.test(e)) refuse("Enter a valid email, or leave it empty.");
    if (e && (await prisma.person.findFirst({ where: { email: e, NOT: { id: personId } } }))) refuse("Someone already uses that email.");
    if (personId === admin.id && (appRole !== "ADMIN" || !active)) refuse("You can't remove your own admin access.");
    await prisma.person.update({ where: { id: personId }, data: { appRole, email: e, active } });
    if (!active) await prisma.session.deleteMany({ where: { personId } });
  });
}

/** Issues a one-time password; the person must choose their own on first sign-in. */
export async function resetPassword(personId: string) {
  return run(async () => {
    await actionAdmin();
    const temp = temporaryPassword();
    await prisma.person.update({ where: { id: personId }, data: { passwordHash: hashPassword(temp), mustChangePassword: true } });
    await prisma.session.deleteMany({ where: { personId } });
    return temp;
  });
}

export async function addIp(name: string) {
  return run(async () => {
    await actionAdmin();
    const n = text(name, "an IP name");
    if (await prisma.ip.findUnique({ where: { name: n } })) refuse(`${n} already exists.`);
    const last = await prisma.ip.findFirst({ orderBy: { sortOrder: "desc" } });
    await prisma.ip.create({ data: { name: n, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  });
}

export async function addIpMember(ipId: string, personId: string, role: PersonRole) {
  return run(async () => {
    await actionAdmin();
    if (!Object.values(PersonRole).includes(role)) refuse("Pick a role.");
    await prisma.personAssignment.upsert({
      where: { personId_ipId_role: { personId, ipId, role } },
      update: {},
      create: { personId, ipId, role },
    });
  });
}

export async function removeIpMember(assignmentId: string) {
  return run(async () => {
    await actionAdmin();
    await prisma.personAssignment.delete({ where: { id: assignmentId } });
  });
}

/* ---------------- ADMIN: FESTIVALS ---------------- */

export async function addFestival(month: number, dateLabel: string, name: string) {
  return run(async () => {
    await actionAdmin();
    if (!(month >= 1 && month <= 12)) refuse("Pick a month.");
    const last = await prisma.festival.findFirst({ orderBy: { sortOrder: "desc" } });
    await prisma.festival.create({
      data: { month, dateLabel: text(dateLabel, "a date", 30), name: text(name, "a festival name"), sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
  });
}

export async function updateFestival(festivalId: string, month: number, dateLabel: string, name: string, active: boolean) {
  return run(async () => {
    await actionAdmin();
    if (!(month >= 1 && month <= 12)) refuse("Pick a month.");
    await prisma.festival.update({
      where: { id: festivalId },
      data: { month, dateLabel: text(dateLabel, "a date", 30), name: text(name, "a festival name"), active },
    });
  });
}

