"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actionAdmin, actionUser, createSession, destroySession, getCurrentUser, type CurrentUser } from "@/lib/auth";
import { hashPassword, temporaryPassword, verifyPassword } from "@/lib/password";
import { getOrCreateCycle } from "@/lib/rotation";
import { WEEKS, addDays, currentMonthKey, istDateTime, todayDateStr, type WeekKey } from "@/lib/dates";
import { AppRole, PersonRole, PlanFormat, PlanKind, StatusState } from "@/generated/prisma/enums";

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
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

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

export async function setBrandIpValue(
  monthKey: string,
  brandId: string,
  ipId: string,
  field: "target" | "achieved" | "live",
  value: number,
) {
  return run(async () => {
    const user = await actionUser();
    checkMonth(monthKey);
    const v = count(value);
    if (!user.isAdmin) {
      const cohortId = await brandCohortId(brandId);
      const leads = user.cohortIds.includes(cohortId);
      if (field === "target" && !leads) refuse("Only this brand's cohort leader sets its targets.");
      if (field !== "target" && !leads && !user.ipcsIpIds.includes(ipId)) {
        refuse("Only this brand's cohort leader or the IP's IP CS can update it.");
      }
    }
    await prisma.brandIpMonth.upsert({
      where: { monthKey_brandId_ipId: { monthKey, brandId, ipId } },
      update: { [field]: v },
      create: { monthKey, brandId, ipId, [field]: v },
    });
  });
}

/* ---------------- ROTATION ---------------- */

async function getEntry(monthKey: string, ipId: string, week: WeekKey) {
  const cycle = await getOrCreateCycle(monthKey);
  return prisma.rotationEntry.findUniqueOrThrow({
    where: { cycleId_ipId_week: { cycleId: cycle.id, ipId, week } },
  });
}

/** Changes an IP's weekly target from this month on (admins). */
export async function setIpWeeklyTarget(monthKey: string, ipId: string, target: number) {
  return run(async () => {
    await actionAdmin();
    checkMonth(monthKey);
    const v = count(target);
    await getOrCreateCycle(monthKey);
    await prisma.ip.update({ where: { id: ipId }, data: { defaultWeeklyTarget: v } });
    await prisma.rotationEntry.updateMany({ where: { ipId, cycle: { monthKey: { gte: monthKey } } }, data: { target: v } });
  });
}

export async function toggleRotationCohort(monthKey: string, ipId: string, week: WeekKey, cohortId: string) {
  return run(async () => {
    await actionAdmin();
    checkMonth(monthKey);
    if (!WEEKS.includes(week)) refuse("Invalid week.");
    const entry = await getEntry(monthKey, ipId, week);
    const existing = await prisma.rotationAssignment.findUnique({
      where: { entryId_cohortId: { entryId: entry.id, cohortId } },
    });
    if (existing) await prisma.rotationAssignment.delete({ where: { id: existing.id } });
    else await prisma.rotationAssignment.create({ data: { entryId: entry.id, cohortId } });
  });
}

/* ---------------- TRADES & COHORT PROGRESS ---------------- */

export async function submitTrade(input: {
  monthKey: string;
  ipId: string;
  week: WeekKey;
  releasedCohortId: string;
  claimedCohortId: string;
  note?: string;
}) {
  return run(async () => {
    const user = await actionUser();
    if (!user.isAdmin && user.appRole !== "COHORT_LEADER") refuse("Only cohort leaders and admins log trades.");
    checkMonth(input.monthKey);
    if (input.releasedCohortId === input.claimedCohortId) refuse("A cohort can't trade with itself.");
    const cycle = await getOrCreateCycle(input.monthKey);
    await prisma.trade.create({
      data: {
        cycleId: cycle.id,
        ipId: input.ipId,
        week: input.week,
        releasedCohortId: input.releasedCohortId,
        claimedCohortId: input.claimedCohortId,
        note: input.note?.trim().slice(0, 300) || null,
      },
    });
  });
}

export async function deleteTrade(tradeId: string) {
  return run(async () => {
    const user = await actionUser();
    if (!user.isAdmin && user.appRole !== "COHORT_LEADER") refuse("Only cohort leaders and admins can remove trades.");
    await prisma.trade.delete({ where: { id: tradeId } });
  });
}

const STATUS_CYCLE: Record<StatusState, StatusState> = {
  PENDING: StatusState.PARTIAL,
  PARTIAL: StatusState.DONE,
  DONE: StatusState.PENDING,
};

export async function cycleCohortWeeklyStatus(monthKey: string, cohortId: string, ipId: string, week: WeekKey) {
  return run(async () => {
    const user = await actionUser();
    if (!user.isAdmin && !user.cohortIds.includes(cohortId) && !user.ipcsIpIds.includes(ipId)) {
      refuse("Only this cohort's leader or the IP's IP CS can update this.");
    }
    const cycle = await getOrCreateCycle(monthKey);
    const where = { cycleId_cohortId_ipId_week: { cycleId: cycle.id, cohortId, ipId, week } };
    const existing = await prisma.cohortWeeklyStatus.findUnique({ where });
    const next = STATUS_CYCLE[existing?.status ?? StatusState.PENDING];
    await prisma.cohortWeeklyStatus.upsert({
      where,
      update: { status: next },
      create: { cycleId: cycle.id, cohortId, ipId, week, status: next },
    });
  });
}

/* ---------------- FESTIVE & NON-IP ---------------- */

/** Add one piece of planned work: `detail` is a festival id for FESTIVAL, or a free-text label (e.g. "Teaser reel") for NON_IP. */
export async function addPlannedEntry(monthKey: string, brandId: string, kind: PlanKind, detail: string, format: PlanFormat) {
  return run(async () => {
    const user = await actionUser();
    checkMonth(monthKey);
    await assertLeadsBrand(user, brandId);
    if (kind === "FESTIVAL") {
      if (!(await prisma.festival.findUnique({ where: { id: detail } }))) refuse("Pick a festival.");
      await prisma.plannedEntry.create({ data: { monthKey, brandId, kind, festivalId: detail, format } });
    } else {
      const workLabel = text(detail, "the non-IP work");
      await prisma.plannedEntry.create({ data: { monthKey, brandId, kind, workLabel, format } });
    }
  });
}

export async function removePlannedEntry(entryId: string) {
  return run(async () => {
    const user = await actionUser();
    const entry = await prisma.plannedEntry.findUnique({ where: { id: entryId } });
    if (!entry) return;
    await assertLeadsBrand(user, entry.brandId);
    await prisma.plannedEntry.delete({ where: { id: entryId } });
  });
}

export async function setPlannedValue(entryId: string, field: "achieved" | "live", value: number) {
  return run(async () => {
    const user = await actionUser();
    const entry = await prisma.plannedEntry.findUnique({ where: { id: entryId } });
    if (!entry) refuse("That row is already gone.");
    checkMonth(entry.monthKey);
    await assertLeadsBrand(user, entry.brandId);
    const v = count(value);
    await prisma.plannedEntry.update({ where: { id: entryId }, data: { [field]: v } });
  });
}

/* ---------------- ATTENDANCE ---------------- */

/**
 * Clock in for today. If yesterday (or an earlier day) was left without a
 * clock-out, that time must be given first.
 */
export async function clockIn(previousClockOut: string | null) {
  return run(async () => {
    const user = await actionUser();
    const today = todayDateStr();
    const open = await prisma.attendanceDay.findFirst({
      where: { personId: user.id, clockOut: null, day: { lt: today } },
      orderBy: { day: "desc" },
    });
    if (open) {
      if (!previousClockOut || !HHMM.test(previousClockOut)) refuse(`Enter the time you clocked out on ${open.day} first.`);
      const out = istDateTime(open.day, previousClockOut);
      if (out <= open.clockIn) refuse("That clock-out time is before you clocked in that day.");
      await prisma.attendanceDay.update({ where: { id: open.id }, data: { clockOut: out, note: "Clock-out added next day" } });
    }
    const existing = await prisma.attendanceDay.findUnique({ where: { personId_day: { personId: user.id, day: today } } });
    if (existing) refuse("You've already clocked in today.");
    await prisma.attendanceDay.create({ data: { personId: user.id, day: today, clockIn: new Date() } });
    return "Clocked in";
  });
}

export async function clockOut() {
  return run(async () => {
    const user = await actionUser();
    const today = todayDateStr();
    const day = await prisma.attendanceDay.findUnique({ where: { personId_day: { personId: user.id, day: today } } });
    if (!day) refuse("You haven't clocked in today.");
    if (day.clockOut) refuse("You've already clocked out today.");
    await prisma.attendanceDay.update({ where: { id: day.id }, data: { clockOut: new Date() } });
    return "Clocked out";
  });
}

/** Admins correct or add a day. Times are India time, "HH:MM"; clock-out may be empty. */
export async function adminSetAttendance(personId: string, day: string, inTime: string, outTime: string) {
  return run(async () => {
    await actionAdmin();
    if (!DAY.test(day) || day > todayDateStr()) refuse("Pick a date that isn't in the future.");
    if (!HHMM.test(inTime)) refuse("Enter a clock-in time like 09:30.");
    if (outTime && !HHMM.test(outTime)) refuse("Enter a clock-out time like 18:30, or leave it empty.");
    const clockIn = istDateTime(day, inTime);
    let clockOutAt = outTime ? istDateTime(day, outTime) : null;
    // A clock-out earlier than clock-in means the shift ran past midnight.
    if (clockOutAt && clockOutAt <= clockIn) clockOutAt = istDateTime(addDays(day, 1), outTime);
    await prisma.attendanceDay.upsert({
      where: { personId_day: { personId, day } },
      update: { clockIn, clockOut: clockOutAt, note: "Edited by admin" },
      create: { personId, day, clockIn, clockOut: clockOutAt, note: "Added by admin" },
    });
  });
}

export async function adminDeleteAttendance(personId: string, day: string) {
  return run(async () => {
    await actionAdmin();
    await prisma.attendanceDay.deleteMany({ where: { personId, day } });
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

export async function addIp(name: string, weeklyTarget: number) {
  return run(async () => {
    await actionAdmin();
    const n = text(name, "an IP name");
    if (await prisma.ip.findUnique({ where: { name: n } })) refuse(`${n} already exists.`);
    const last = await prisma.ip.findFirst({ orderBy: { sortOrder: "desc" } });
    await prisma.ip.create({ data: { name: n, defaultWeeklyTarget: count(weeklyTarget), sortOrder: (last?.sortOrder ?? 0) + 1 } });
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

