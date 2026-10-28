import Link from "next/link";
import { PageHeader, Card, CardHead, Th, Td } from "@/components/ui";
import { YearSwitcher } from "@/components/Switchers";
import {
  AddBrandForm,
  AddCohortForm,
  AddFestivalForm,
  AddIpForm,
  AddIpMemberForm,
  AddPersonForm,
  BrandRow,
  BufferSettingsForm,
  CohortIpsForm,
  CohortLeaderSelect,
  FestivalRow,
  IpMemberChip,
  MonthOverrideCell,
  PersonRow,
  TargetSettingsForm,
} from "@/components/AdminControls";
import { prisma } from "@/lib/prisma";
import { requireAdminPage, ROLE_LABEL } from "@/lib/auth";
import { getFestivals, getCalendarBufferDays } from "@/lib/queries";
import { getYearSummary } from "@/lib/targets";
import { currentMonthKey, monthKeyLabel, yearLabel, yearStartFor } from "@/lib/dates";

const TABS = [
  { key: "targets", label: "Targets" },
  { key: "cohorts", label: "Cohorts & Brands" },
  { key: "people", label: "People & Logins" },
  { key: "ips", label: "IP Teams" },
  { key: "festivals", label: "Festivals" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string }> }) {
  await requireAdminPage();
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "targets";

  return (
    <div>
      <PageHeader title="Admin" subtitle="Master controls for Ishika and Unnati" />
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            className="h-9 inline-flex items-center rounded-lg border px-3.5 text-[11.5px] font-semibold"
            style={{
              borderColor: tab === t.key ? "var(--brand-ink)" : "var(--border)",
              background: tab === t.key ? "var(--brand-ink)" : "var(--surface-raised)",
              color: tab === t.key ? "#fff" : "var(--text-secondary)",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "targets" && <TargetsTab year={params.year} />}
      {tab === "cohorts" && <CohortsTab />}
      {tab === "people" && <PeopleTab />}
      {tab === "ips" && <IpsTab />}
      {tab === "festivals" && <FestivalsTab />}
    </div>
  );
}

async function TargetsTab({ year }: { year?: string }) {
  const thisYear = yearStartFor(currentMonthKey());
  const requested = Number(year);
  const startYear = Number.isInteger(requested) && requested > 2000 && requested < 2100 ? requested : thisYear;
  const [summary, settings, bufferDays] = await Promise.all([getYearSummary(startYear), prisma.monthSetting.findMany(), getCalendarBufferDays()]);
  const byMonth = new Map(settings.map((s) => [s.monthKey, s]));
  return (
    <>
      <Card className="mb-5">
        <CardHead title="Calendar buffer" subtitle="How many days before a post's date production is due. Drives every IP CS's task list." />
        <BufferSettingsForm bufferDays={bufferDays} />
      </Card>
      <Card className="mb-5">
        <CardHead title="IP target rule" subtitle="Every month's IP base = this base + the amount below for each brand added after launch. Applies to every month without its own base." />
        <TargetSettingsForm baseMonthly={summary.settings.baseMonthly} perBrand={summary.settings.perBrand} />
      </Card>
      <Card>
        <CardHead
          title={`Month by month · ${yearLabel(startYear)}`}
          subtitle="Set a different base for a month, or enter the achieved total for months before the matrix was used (e.g. Jun–Aug 2026). Clear a box to go back to the automatic value."
          right={<YearSwitcher years={[thisYear - 1, thisYear, thisYear + 1]} current={startYear} />}
        />
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th align="right">Automatic base</Th>
                <Th align="right">Base for this month</Th>
                <Th align="right">Backlog in</Th>
                <Th align="right">Target</Th>
                <Th align="right">Achieved (all output)</Th>
                <Th align="right">Achieved (entered)</Th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => {
                const s = byMonth.get(r.monthKey);
                const automatic = summary.settings.baseMonthly + summary.settings.perBrand * r.newBrands;
                return (
                  <tr key={r.monthKey} style={{ background: r.timing === "current" ? "var(--brand-soft)" : undefined }}>
                    <Td className="font-bold">{monthKeyLabel(r.monthKey, "short")}</Td>
                    <Td align="right" className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {automatic}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      <MonthOverrideCell monthKey={r.monthKey} field="baseOverride" value={s?.baseOverride ?? null} />
                    </Td>
                    <Td align="right" className="tabular-nums">{r.backlogIn ?? "—"}</Td>
                    <Td align="right" className="tabular-nums font-bold">{r.target}</Td>
                    <Td align="right" className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {r.achievedIsOverride ? "(replaced)" : r.achieved}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      <MonthOverrideCell monthKey={r.monthKey} field="achievedOverride" value={s?.achievedOverride ?? null} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

async function CohortsTab() {
  const [cohorts, people, ips] = await Promise.all([
    prisma.cohort.findMany({ orderBy: { code: "asc" }, include: { brands: { orderBy: { name: "asc" } }, ips: true } }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    // Only the current bucket list (see applyContentBucketRelist in seed.ts) - the old launch-era
    // IP names are kept around for Shoot Schedule/assignment history but sorted below 1000, out of this picker.
    prisma.ip.findMany({ where: { sortOrder: { lt: 1000 } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const cohortOptions = cohorts.map((c) => ({ id: c.id, label: `${c.code} · ${c.leaderName}` }));
  const peopleOptions = people.map((p) => ({ id: p.id, label: `${p.name} (${ROLE_LABEL[p.appRole]})` }));
  const ipOptions = ips.map((ip) => ({ id: ip.id, label: ip.name }));
  return (
    <>
      <Card className="mb-5">
        <CardHead title="Add" subtitle="A brand added now raises the IP base target from this month on." />
        <div className="flex flex-col gap-3 p-5">
          <AddBrandForm cohorts={cohortOptions} />
          <AddCohortForm people={peopleOptions} />
        </div>
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {cohorts.map((c) => (
          <Card key={c.id}>
            <CardHead
              title={`${c.code} · ${c.leaderName}`}
              subtitle={`${c.brands.filter((b) => !b.archivedMonthKey).length} active brands · change a brand's cohort to move it`}
              right={<CohortLeaderSelect cohortId={c.id} current={c.leaderPersonId} people={peopleOptions} />}
            />
            <div className="px-5 pt-3">
              <div className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Fixed IPs — this cohort only logs work against these
              </div>
              <CohortIpsForm cohortId={c.id} allIps={ipOptions} selected={c.ips.map((ip) => ip.id)} />
            </div>
            <div className="px-5 py-2">
              {c.brands.map((b) => (
                <BrandRow
                  key={b.id}
                  brand={{ id: b.id, name: b.name, cohortId: b.cohortId, archived: Boolean(b.archivedMonthKey), addedMonthKey: b.addedMonthKey }}
                  cohorts={cohortOptions}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

async function PeopleTab() {
  const people = await prisma.person.findMany({ orderBy: [{ appRole: "asc" }, { name: "asc" }] });
  return (
    <Card>
      <CardHead
        title="People & logins"
        subtitle="Everyone signs in with their name (or email) and a password. Use Create login to issue a one-time password; they choose their own on first sign-in."
        right={<AddPersonForm />}
      />
      <div className="overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Email</Th>
              <Th align="center">Active</Th>
              <Th>Login</Th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <PersonRow
                key={p.id}
                person={{
                  id: p.id,
                  name: p.name,
                  appRole: p.appRole,
                  email: p.email,
                  active: p.active,
                  hasPassword: Boolean(p.passwordHash),
                  mustChangePassword: p.mustChangePassword,
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function IpsTab() {
  const [ips, people] = await Promise.all([
    prisma.ip.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { assignments: { include: { person: true }, orderBy: { role: "asc" } } },
    }),
    prisma.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const options = people.map((p) => ({ id: p.id, label: p.name }));
  const ROLE = { IP_CS: "IP CS", DESIGNER: "Designer", EDITOR: "Editor" } as const;
  return (
    <>
      <Card className="mb-5">
        <CardHead title="Add an IP" subtitle="Pair it with cohorts on the Cohorts & Brands tab" />
        <div className="p-5">
          <AddIpForm />
        </div>
      </Card>
      <Card>
        <CardHead title="IP teams" subtitle="Who handles each IP. Used for dashboard and matrix permissions." />
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <Th>IP</Th>
                <Th>Team</Th>
              </tr>
            </thead>
            <tbody>
              {ips.map((ip) => (
                <tr key={ip.id} style={{ opacity: ip.sortOrder >= 1000 ? 0.55 : 1 }}>
                  <Td className="font-bold align-top">
                    {ip.name}
                    {ip.sortOrder >= 1000 && (
                      <div className="text-[9.5px] font-normal" style={{ color: "var(--text-muted)" }}>
                        old bucket name — not shown on Cohorts &amp; Brands
                      </div>
                    )}
                  </Td>
                  <Td>
                    {ip.assignments.map((a) => (
                      <IpMemberChip key={a.id} assignmentId={a.id} label={`${ROLE[a.role]}: ${a.person.name}`} />
                    ))}
                    <AddIpMemberForm ipId={ip.id} people={options} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

async function FestivalsTab() {
  const festivals = await getFestivals(true);
  return (
    <Card>
      <CardHead
        title={`Festival list (${festivals.filter((f) => f.active).length} shown in the dropdown)`}
        subtitle="Update dates each year; hide a festival to remove it from the dropdown without losing past entries."
        right={<AddFestivalForm />}
      />
      <div className="px-5 py-3">
        {festivals.map((f) => (
          <FestivalRow key={f.id} festival={{ id: f.id, name: f.name, month: f.month, dateLabel: f.dateLabel, active: f.active }} />
        ))}
      </div>
    </Card>
  );
}
