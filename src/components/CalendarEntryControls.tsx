"use client";

import { useTransition } from "react";
import { setEntryStatus, setEntryRemarks, removeCalendarEntry } from "@/lib/actions";
import { EditableText } from "@/components/EditableText";
import { STATUS_OPTIONS, STATUS_LABEL, STATUS_MEANING, STATUS_COLOR } from "@/lib/entryStatus";
import type { EntryStatus } from "@/generated/prisma/enums";

/** Status dropdown for one post: WIP, ATR, CTR, Live or Rejected. */
export function EntryStatusSelect({ entryId, status }: { entryId: string; status: EntryStatus }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      aria-label="Status"
      title={STATUS_MEANING[status]}
      onChange={(e) => {
        const next = e.target.value as EntryStatus;
        startTransition(async () => {
          const r = await setEntryStatus(entryId, next);
          if (!r.ok) alert(r.error);
        });
      }}
      className="h-7 rounded-md border px-1.5 font-bold"
      style={{
        width: 172,
        fontSize: 11,
        borderColor: "var(--border)",
        background: "var(--surface-raised)",
        color: STATUS_COLOR[status],
        opacity: pending ? 0.5 : 1,
      }}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s} style={{ color: "var(--text-primary)" }}>
          {STATUS_LABEL[s] === STATUS_MEANING[s] ? STATUS_LABEL[s] : `${STATUS_LABEL[s]} — ${STATUS_MEANING[s]}`}
        </option>
      ))}
    </select>
  );
}

/** Click to add or edit a remark on a post. */
export function EntryRemarks({ entryId, remarks }: { entryId: string; remarks: string }) {
  return (
    <span className="text-[10.5px]" style={{ color: remarks ? "var(--text-primary)" : "var(--text-muted)" }}>
      <EditableText value={remarks} allowEmpty placeholder="Add remark" label="remarks" onCommit={(v) => setEntryRemarks(entryId, v)} />
    </span>
  );
}

/** Deletes a post that was planned by mistake. */
export function RemoveEntryButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Remove this planned post"
      aria-label="Remove"
      onClick={() => {
        if (!confirm("Remove this planned post?")) return;
        startTransition(async () => {
          const r = await removeCalendarEntry(entryId);
          if (!r.ok) alert(r.error);
        });
      }}
      className="text-[12px] px-1"
      style={{ color: "var(--text-muted)", opacity: pending ? 0.5 : 1 }}
    >
      ✕
    </button>
  );
}
