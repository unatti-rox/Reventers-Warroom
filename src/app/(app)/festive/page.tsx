import { PageHeader, Card, CardHead, KpiTile, Th, Td, EmptyNote } from "@/components/ui";
import { MonthSwitcher, ParamSelect } from "@/components/Switchers";
import { AddPlannedEntryForm, PlannedNumber, RemovePlannedButton, FORMAT_LABEL } from "@/components/FestiveControls";
import { getPlannedView } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { currentMonthKey, monthKeyLabel, yearMonths, yearStartFor } from "@/lib/dates";

export default async function FestivePage({ searchParams }: { searchParams: Promise<{ month?: string; cohort?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const now = currentMonthKey();
  const monthKey = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : now;
  const view = await getPlannedView(monthKey);

  // Cohort leaders land on their own cohort; everyone can switch to see others.
  const defaultCohort = !user.isAdmin && user.cohortIds.length ? view.cohorts.find((c) => c.id === user.cohortIds[0])?.code ?? "" : "";
  const cohortCode = params.cohort ?? defaultCohort;
  const cohorts = cohortCode ? view.cohorts.filter((c) => c.code === cohortCode) : view.cohorts;
  const canEdit = (cohortId: string) => user.isAdmin || user.cohortIds.includes(cohortId);
  const editableBrands = cohorts.filter((c) => canEdit(c.id)).flatMap((c) => c.brands.map((b) => ({ id: b.id, label: `${b.name} (${c.leaderName})` })));
  const brandInfo = new Map(view.cohorts.flatMap((c) => c.brands.map((b) => [b.id, { name: b.name, cohort: c }] as const)));
  const shownRows = view.rows
    .filter((r) => cohorts.some((c) => c.id === brandInfo.get(r.brandId)?.cohort.id))
    .sort((a, b) => (brandInfo.get(a.brandId)?.name ?? "").localeCompare(brandInfo.get(b.brandId)?.name ?? "") || a.detail.localeCompare(b.detail));

  return (
    <div>
      <PageHeader
        title="Festive & Non-IP"
        subtitle="Cohort leaders log each brand's festive and non-IP pieces, then track achieved and live. Handled by the floaters; not part of the IP target."
        right={
          <>
            <MonthSwitcher monthKeys={yearMonths(yearStartFor(now))} current={monthKey} />
            <ParamSelect
              param="cohort"
              label="Cohort"
              value={cohortCode}
              options={[{ value: "", label: "All cohorts" }, ...view.cohorts.map((c) => ({ value: c.code, label: `${c.code} · ${c.leaderName}` }))]}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <KpiTile label="Festive" value={view.festiveTotal.achieved} meta={`${view.festiveTotal.live} live`} />
        <KpiTile label="Non-IP" value={view.nonIpTotal.achieved} meta={`${view.nonIpTotal.live} live`} />
        <KpiTile label="Total pieces" value={shownRows.length} meta={`Whole team, ${monthKeyLabel(monthKey, "short")}`} />
      </div>

      <Card>
        <CardHead title="Planned work" subtitle="One row per piece of content" />
        {editableBrands.length > 0 && (
          <AddPlannedEntryForm monthKey={monthKey} brands={editableBrands} festivals={view.festivals} defaultMonth={Number(monthKey.slice(5, 7))} />
        )}
        <div className="overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <Th>Brand</Th>
                <Th>Non-IP / Festive</Th>
                <Th>What non-IP work / Which festival</Th>
                <Th>Story / Reel / AV / GIF</Th>
                <Th align="right">Achieved</Th>
                <Th align="right">Live</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {shownRows.map((r) => {
                const info = brandInfo.get(r.brandId);
                const editable = info ? canEdit(info.cohort.id) : false;
                return (
                  <tr key={r.id}>
                    <Td>
                      <div className="font-bold">{info?.name}</div>
                      <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
                        {info?.cohort.code} · {info?.cohort.leaderName}
                      </div>
                    </Td>
                    <Td>{r.kind === "FESTIVAL" ? "Festival" : "Non-IP"}</Td>
                    <Td>
                      <div className="font-semibold">{r.detail}</div>
                      {r.dateLabel && (
                        <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
                          {r.dateLabel}
                        </div>
                      )}
                    </Td>
                    <Td>{FORMAT_LABEL[r.format]}</Td>
                    <Td align="right" className="tabular-nums">
                      <PlannedNumber entryId={r.id} field="achieved" value={r.achieved} editable={editable} />
                    </Td>
                    <Td align="right" className="tabular-nums">
                      <PlannedNumber entryId={r.id} field="live" value={r.live} editable={editable} />
                    </Td>
                    <Td align="center">{editable && <RemovePlannedButton entryId={r.id} />}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shownRows.length === 0 && (
            <EmptyNote>Nothing planned for {monthKeyLabel(monthKey)} yet{editableBrands.length ? " — add a brand above." : "."}</EmptyNote>
          )}
        </div>
      </Card>
    </div>
  );
}
