import { CollapsibleCard } from "@/components/CollapsibleCard";
import { PieceLogControls } from "@/components/PieceLogControls";
import { TargetCell, PlannedPieceRow, AddPlannedPieceForm } from "@/components/LogItControls";
import type { PlannedRow } from "@/lib/queries";

type Cell = { target: number; achieved: number; live: number };

/** One brand: its cohort's fixed IPs (target + Log it), and its Festive/Non-IP pieces. The one card a cohort leader needs per brand. */
export function LogItBrandCard({
  monthKey,
  brandId,
  brandName,
  subtitle,
  ips,
  cellMap,
  planned,
  festivals,
  defaultOpen = false,
}: {
  monthKey: string;
  brandId: string;
  brandName: string;
  subtitle?: string;
  ips: { id: string; name: string }[];
  cellMap: Map<string, Cell>;
  planned: PlannedRow[];
  festivals: { id: string; name: string; dateLabel: string; month: number }[];
  defaultOpen?: boolean;
}) {
  const rows = ips.map((ip) => ({ ip, cell: cellMap.get(`${brandId}:${ip.id}`) ?? { target: 0, achieved: 0, live: 0 } }));
  const totalTarget = rows.reduce((s, r) => s + r.cell.target, 0);
  const totalAchieved = rows.reduce((s, r) => s + r.cell.achieved, 0);

  return (
    <CollapsibleCard title={brandName} subtitle={subtitle} meta={`${totalAchieved} / ${totalTarget}`} defaultOpen={defaultOpen}>
      {ips.length === 0 ? (
        <div className="text-[11px] py-5 text-center" style={{ color: "var(--text-muted)" }}>
          No IPs fixed to this cohort yet — set that in Admin → Cohorts &amp; Brands.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-5 py-2 border-b text-[9px] font-bold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <span className="flex-1">IP</span>
            <span className="w-14 text-right">Target</span>
            <span className="text-right">Log it</span>
          </div>
          {rows.map(({ ip, cell }) => (
            <div key={ip.id} className="flex items-center gap-3 px-5 py-2.5 border-b last:border-0 flex-wrap" style={{ borderColor: "var(--border)" }}>
              <div className="flex-1 min-w-0 text-[12px] font-bold truncate">{ip.name}</div>
              <div className="w-14 text-right">
                <TargetCell monthKey={monthKey} brandId={brandId} ipId={ip.id} value={cell.target} label={`${brandName} ${ip.name} target`} />
              </div>
              <PieceLogControls monthKey={monthKey} brandId={brandId} ipId={ip.id} achieved={cell.achieved} live={cell.live} label={`${brandName} ${ip.name}`} />
            </div>
          ))}
        </>
      )}
      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="px-5 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Festive &amp; Non-IP
        </div>
        {planned.map((row) => (
          <PlannedPieceRow
            key={`${row.kind}:${row.detail}:${row.format}`}
            monthKey={monthKey}
            brandId={brandId}
            kind={row.kind}
            detail={row.detail}
            format={row.format}
            label={row.label}
            achieved={row.achieved}
            live={row.live}
          />
        ))}
        {planned.length === 0 && (
          <div className="px-5 py-2 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
            Nothing logged yet this month.
          </div>
        )}
        <AddPlannedPieceForm monthKey={monthKey} brandId={brandId} festivals={festivals} />
      </div>
    </CollapsibleCard>
  );
}
