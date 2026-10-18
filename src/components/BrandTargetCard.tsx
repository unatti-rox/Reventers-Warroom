import { CollapsibleCard } from "@/components/CollapsibleCard";
import { BrandIpNumberCell } from "@/components/BrandIpNumberCell";
import { statusFrom } from "@/lib/rotation";
import type { StatusState } from "@/generated/prisma/enums";

const TONE: Record<StatusState, string> = {
  PENDING: "transparent",
  PARTIAL: "var(--status-warning-bg)",
  DONE: "var(--status-good-bg)",
};

type Cell = { target: number; achieved: number; live: number };

/** One brand, collapsed to a single "achieved / target" number until opened to show Target · Achieved · Live per IP. */
export function BrandTargetCard({
  monthKey,
  brandId,
  brandName,
  subtitle,
  ips,
  cellMap,
  defaultOpen = false,
}: {
  monthKey: string;
  brandId: string;
  brandName: string;
  subtitle?: string;
  ips: { id: string; name: string }[];
  cellMap: Map<string, Cell>;
  defaultOpen?: boolean;
}) {
  const rows = ips.map((ip) => ({ ip, cell: cellMap.get(`${brandId}:${ip.id}`) ?? { target: 0, achieved: 0, live: 0 } }));
  const totalTarget = rows.reduce((s, r) => s + r.cell.target, 0);
  const totalAchieved = rows.reduce((s, r) => s + r.cell.achieved, 0);

  return (
    <CollapsibleCard title={brandName} subtitle={subtitle} meta={`${totalAchieved} / ${totalTarget}`} defaultOpen={defaultOpen}>
      <div
        className="flex items-center gap-3 px-5 py-2 border-b text-[9px] font-bold uppercase tracking-wide"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <span className="flex-1">IP</span>
        <span className="w-16 text-right">Target</span>
        <span className="w-16 text-right">Achieved</span>
        <span className="w-16 text-right">Live</span>
      </div>
      {rows.map(({ ip, cell }) => (
        <div
          key={ip.id}
          className="flex items-center gap-3 px-5 py-2.5 border-b last:border-0"
          style={{ borderColor: "var(--border)", background: TONE[statusFrom(cell.target, cell.achieved)] }}
        >
          <div className="flex-1 min-w-0 text-[12px] font-bold truncate">{ip.name}</div>
          <div className="w-16 text-right">
            <BrandIpNumberCell monthKey={monthKey} brandId={brandId} ipId={ip.id} field="target" value={cell.target} label={`${brandName} ${ip.name} target`} />
          </div>
          <div className="w-16 text-right">
            <BrandIpNumberCell monthKey={monthKey} brandId={brandId} ipId={ip.id} field="achieved" value={cell.achieved} label={`${brandName} ${ip.name} achieved`} />
          </div>
          <div className="w-16 text-right">
            <BrandIpNumberCell monthKey={monthKey} brandId={brandId} ipId={ip.id} field="live" value={cell.live} label={`${brandName} ${ip.name} live`} />
          </div>
        </div>
      ))}
    </CollapsibleCard>
  );
}
