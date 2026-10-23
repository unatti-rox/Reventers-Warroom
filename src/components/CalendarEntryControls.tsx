"use client";

import { useTransition } from "react";
import { markEntryDone, markEntryLive, undoEntryStatus, removeCalendarEntry, type ActionResult } from "@/lib/actions";
import type { EntryStatus } from "@/generated/prisma/enums";

const BTN = "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide disabled:opacity-40";

export const STATUS_LABEL: Record<EntryStatus, string> = { PENDING: "Planned", DONE: "Produced", LIVE: "Live" };
export const STATUS_COLOR: Record<EntryStatus, string> = {
  PENDING: "var(--text-muted)",
  DONE: "var(--status-warning)",
  LIVE: "var(--status-good)",
};

/** Tap to advance a specific planned post: PENDING → DONE → LIVE, with Undo to step back. No counting, no typing - just where this one named post is. */
export function CalendarEntryControls({ entryId, status, removable = true }: { entryId: string; status: EntryStatus; removable?: boolean }) {
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<ActionResult>) => () =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
    });

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {status === "PENDING" && (
        <button type="button" disabled={pending} onClick={act(() => markEntryDone(entryId))} className={BTN} style={{ background: "var(--brand-ink)", color: "#fff" }}>
          Mark done
        </button>
      )}
      {status !== "LIVE" && (
        <button type="button" disabled={pending} onClick={act(() => markEntryLive(entryId))} className={BTN} style={{ background: "var(--status-good-bg)", color: "var(--text-primary)" }}>
          Mark live
        </button>
      )}
      {status !== "PENDING" && (
        <button type="button" disabled={pending} onClick={act(() => undoEntryStatus(entryId))} className={BTN} style={{ background: "var(--surface-tint)", color: "var(--text-secondary)" }}>
          Undo
        </button>
      )}
      {removable && status === "PENDING" && (
        <button
          type="button"
          disabled={pending}
          title="Remove this planned post"
          aria-label="Remove"
          onClick={() => {
            if (!confirm("Remove this planned post?")) return;
            act(() => removeCalendarEntry(entryId))();
          }}
          className="text-[13px] px-1"
          style={{ color: "var(--status-critical)", opacity: pending ? 0.5 : 1 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
