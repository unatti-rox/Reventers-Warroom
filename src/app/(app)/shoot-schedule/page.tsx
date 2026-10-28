import { PageHeader, Card, CardHead, Th, Td, EmptyNote } from "@/components/ui";
import { MonthSwitcher } from "@/components/Switchers";
import { AddShootForm, DOP_PEOPLE, RemoveShootButton, ShootBrandCell, ShootIpCell, ShootPersonCell, ShootTextCell, SOCIAL_MEDIA_PEOPLE } from "@/components/ShootScheduleControls";
import { getShootsView } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { currentMonthKey, monthKeyLabel, yearMonths, yearStartFor } from "@/lib/dates";

export default async function ShootSchedulePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;
  const { cohorts, ips, shoots } = await getShootsView(monthKey);

  const canEdit = (cohortId: string) => user.isAdmin || user.cohortIds.includes(cohortId);
  const editableCohorts = cohorts
    .filter((c) => canEdit(c.id))
    .map((c) => ({ id: c.id, label: `${c.code} · ${c.leaderName}`, brands: c.brands.map((b) => ({ id: b.id, name: b.name })) }));
  const cohortById = new Map(cohorts.map((c) => [c.id, c]));
  // Current content buckets only (old launch-era IP names sit at sortOrder >= 1000); a shoot that still
  // uses an old name keeps it in its own row's dropdown.
  const ipOptions = ips.filter((ip) => ip.sortOrder < 1000).map((ip) => ({ id: ip.id, name: ip.name }));
  const ipById = new Map(ips.map((ip) => [ip.id, { id: ip.id, name: ip.name }]));
  const ipOptionsFor = (ipId: string) => (ipOptions.some((o) => o.id === ipId) || !ipById.has(ipId) ? ipOptions : [ipById.get(ipId)!, ...ipOptions]);

  return (
    <div>
      <PageHeader
        title="Shoot Schedule"
        subtitle="Who's shooting what, when, and with which DOP, social media person and CS"
        right={<MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} />}
      />
      <Card>
        <CardHead title="Scheduled shoots" subtitle="One row per shoot · tap a cell to edit it" />
        {editableCohorts.length > 0 && <AddShootForm cohorts={editableCohorts} ips={ipOptions} />}
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Cohort</Th>
                <Th>Brand</Th>
                <Th>IP</Th>
                <Th>Date</Th>
                <Th>Time</Th>
                <Th>DOP</Th>
                <Th>Social media person</Th>
                <Th>CS</Th>
                <Th>Remarks</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {shoots.map((s, i) => {
                const cohort = cohortById.get(s.cohortId);
                const editable = cohort ? canEdit(cohort.id) : false;
                return (
                  <tr key={s.id}>
                    <Td className="tabular-nums">{i + 1}</Td>
                    <Td>
                      <div className="font-bold">{cohort?.code}</div>
                      <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
                        {cohort?.leaderName}
                      </div>
                    </Td>
                    <Td>
                      <ShootBrandCell shootId={s.id} brandId={s.brandId} brands={cohort?.brands.map((b) => ({ id: b.id, name: b.name })) ?? []} editable={editable} />
                    </Td>
                    <Td>
                      <ShootIpCell shootId={s.id} ipId={s.ipId} ips={ipOptionsFor(s.ipId)} editable={editable} />
                    </Td>
                    <Td className="tabular-nums whitespace-nowrap">
                      <ShootTextCell shootId={s.id} field="date" value={s.date} editable={editable} type="date" label={`${cohort?.code} shoot date`} />
                    </Td>
                    <Td className="tabular-nums whitespace-nowrap">
                      <ShootTextCell shootId={s.id} field="time" value={s.time} editable={editable} type="time" allowEmpty label={`${cohort?.code} shoot time`} />
                    </Td>
                    <Td>
                      <ShootPersonCell shootId={s.id} field="dop" value={s.dop} options={DOP_PEOPLE} editable={editable} label={`${cohort?.code} DOP`} />
                    </Td>
                    <Td>
                      <ShootPersonCell shootId={s.id} field="socialMediaPerson" value={s.socialMediaPerson} options={SOCIAL_MEDIA_PEOPLE} editable={editable} label={`${cohort?.code} social media person`} />
                    </Td>
                    <Td>
                      <ShootTextCell shootId={s.id} field="cs" value={s.cs} editable={editable} allowEmpty label={`${cohort?.code} CS`} />
                    </Td>
                    <Td>
                      <ShootTextCell shootId={s.id} field="remarks" value={s.remarks} editable={editable} allowEmpty label={`${cohort?.code} remarks`} />
                    </Td>
                    <Td align="center">{editable && <RemoveShootButton shootId={s.id} />}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shoots.length === 0 && (
            <EmptyNote>Nothing scheduled for {monthKeyLabel(monthKey)} yet{editableCohorts.length ? " — add a shoot above." : "."}</EmptyNote>
          )}
        </div>
      </Card>
    </div>
  );
}
