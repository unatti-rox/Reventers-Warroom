import { CalendarEntryControls } from "@/components/CalendarEntryControls";
import type { EntryStatus } from "@/generated/prisma/enums";

/** One task on an IP CS's computed to-do list: what to make, for which brand, and how urgent it is — nobody assigned this, the post date did. */
export function TaskListRow({
  entryId,
  status,
  brandName,
  cohortCode,
  title,
  postDate,
  dueDate,
  urgencyLabel,
  urgencyColor,
}: {
  entryId: string;
  status: EntryStatus;
  brandName: string;
  cohortCode: string;
  title: string;
  postDate: string;
  dueDate: string;
  urgencyLabel: string;
  urgencyColor: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 border-b last:border-0 flex-wrap" style={{ borderColor: "var(--border)" }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: urgencyColor }} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold truncate">
          {title} <span className="font-normal">· {brandName}</span>
        </div>
        <div className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
          {cohortCode} · due {dueDate} · posts {postDate}
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: urgencyColor }}>
        {urgencyLabel}
      </span>
      <CalendarEntryControls entryId={entryId} status={status} removable={false} />
    </div>
  );
}
