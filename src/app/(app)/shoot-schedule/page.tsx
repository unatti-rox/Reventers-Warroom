import { PageHeader, Card, CardHead, Th, Td, EmptyNote } from "@/components/ui";
import { MonthSwitcher } from "@/components/Switchers";
import { AddShootForm, RemoveShootButton, ShootTextCell } from "@/components/ShootScheduleControls";
import { getShootsView } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { currentMonthKey, monthKeyLabel, yearMonths, yearStartFor } from "@/lib/dates";

export default async function ShootSchedulePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;
  const { cohorts, shoots } = await getShootsView(monthKey);

  const canEdit = (cohortId: string) => user.isAdmin || user.cohortIds.includes(cohortId);
  const editableCohorts = cohorts.filter((c) => canEdit(c.id)).map((c) => ({ id: c.id, label: `${c.code} · ${c.leaderName}` }));
  const cohortById = new Map(cohorts.map((c) => [c.id, c]));

  return (
    <div>
      <PageHeader
        title="Shoot Schedule"
        subtitle="Who's shooting what, when, and with which DOP and social media person"
        right={<MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} />}
      />
      <Card>
        <CardHead title="Scheduled shoots" subtitle="One row per shoot · tap a cell to edit it" />
        {editableCohorts.length > 0 && <AddShootForm cohorts={editableCohorts} />}
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Cohort</Th>
                <Th>Shoot detail</Th>
                <Th>Date</Th>
                <Th>DOP</Th>
                <Th>Social media person</Th>
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
                      <ShootTextCell shootId={s.id} field="detail" value={s.detail} editable={editable} label={`${cohort?.code} shoot detail`} />
                    </Td>
                    <Td className="tabular-nums whitespace-nowrap">
                      <ShootTextCell shootId={s.id} field="date" value={s.date} editable={editable} type="date" label={`${cohort?.code} shoot date`} />
                    </Td>
                    <Td>
                      <ShootTextCell shootId={s.id} field="dop" value={s.dop} editable={editable} label={`${cohort?.code} DOP`} />
                    </Td>
                    <Td>
                      <ShootTextCell shootId={s.id} field="socialMediaPerson" value={s.socialMediaPerson} editable={editable} label={`${cohort?.code} social media person`} />
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
