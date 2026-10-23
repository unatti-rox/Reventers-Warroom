import { CollapsibleCard } from "@/components/CollapsibleCard";
import { CalendarEntryControls, STATUS_LABEL, STATUS_COLOR } from "@/components/CalendarEntryControls";
import { AddCalendarEntryForm, FORMAT_LABEL } from "@/components/AddCalendarEntryForm";
import type { CalendarEntryRow } from "@/lib/queries";

/** One brand's whole plan for the month: every post, in one place, plus the form to add more. */
export function CalendarBrandCard({
  brandId,
  brandName,
  subtitle,
  ips,
  entries,
  festivals,
  monthKey,
  defaultOpen = false,
}: {
  brandId: string;
  brandName: string;
  subtitle?: string;
  ips: { id: string; name: string }[];
  entries: CalendarEntryRow[];
  festivals: { id: string; name: string; dateLabel: string; month: number }[];
  monthKey: string;
  defaultOpen?: boolean;
}) {
  const done = entries.filter((e) => e.status !== "PENDING").length;

  return (
    <CollapsibleCard title={brandName} subtitle={subtitle} meta={`${done} / ${entries.length}`} defaultOpen={defaultOpen}>
      <div className="flex items-center gap-3 px-5 py-2 border-b text-[9px] font-bold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <span className="flex-1">Post</span>
        <span className="w-20">Date</span>
        <span className="w-16">Status</span>
        <span className="text-right">Action</span>
      </div>
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-3 px-5 py-2.5 border-b last:border-0 flex-wrap" style={{ borderColor: "var(--border)" }}>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold truncate">{e.title}</div>
            <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
              {e.kind === "REGULAR" ? e.ipName : e.kind === "FESTIVAL" ? e.festivalName : "Non-IP"}
              {e.format ? ` · ${FORMAT_LABEL[e.format]}` : ""}
            </div>
          </div>
          <div className="w-20 text-[11px] tabular-nums">{e.postDate}</div>
          <div className="w-16 text-[10.5px] font-bold" style={{ color: STATUS_COLOR[e.status] }}>
            {STATUS_LABEL[e.status]}
          </div>
          <CalendarEntryControls entryId={e.id} status={e.status} />
        </div>
      ))}
      {entries.length === 0 && (
        <div className="px-5 py-4 text-[10.5px] text-center" style={{ color: "var(--text-muted)" }}>
          Nothing planned for this brand yet.
        </div>
      )}
      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <AddCalendarEntryForm brandId={brandId} ips={ips} festivals={festivals} defaultMonth={Number(monthKey.slice(5, 7))} />
      </div>
    </CollapsibleCard>
  );
}
