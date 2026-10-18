"use client";

import { useState, useTransition } from "react";
import { EditableNumber } from "@/components/EditableNumber";
import { addPlannedEntry, removePlannedEntry, setPlannedValue } from "@/lib/actions";
import { inputStyle, primaryButtonStyle } from "@/components/ui";
import type { PlanFormat, PlanKind } from "@/generated/prisma/enums";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FORMATS: PlanFormat[] = ["STORY", "REEL", "AV", "GIF"];
export const FORMAT_LABEL: Record<PlanFormat, string> = { STORY: "Story", REEL: "Reel", AV: "AV", GIF: "GIF" };

export function PlannedNumber({
  entryId,
  field,
  value,
  editable,
}: {
  entryId: string;
  field: "achieved" | "live";
  value: number;
  editable: boolean;
}) {
  return <EditableNumber value={value} readOnly={!editable} label={field} onCommit={(v) => setPlannedValue(entryId, field, v ?? 0)} />;
}

export function RemovePlannedButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Remove this row"
      aria-label="Remove"
      onClick={() => {
        if (!confirm("Remove this row and its numbers?")) return;
        startTransition(async () => {
          const r = await removePlannedEntry(entryId);
          if (!r.ok) alert(r.error);
        });
      }}
      className="text-[13px]"
      style={{ color: "var(--status-critical)", opacity: pending ? 0.5 : 1 }}
    >
      ✕
    </button>
  );
}

/** Pick a brand, Festival or Non-IP work, then the detail (festival name, or a free-text label). */
export function AddPlannedEntryForm({
  monthKey,
  brands,
  festivals,
  defaultMonth,
}: {
  monthKey: string;
  brands: { id: string; label: string }[];
  festivals: { id: string; name: string; dateLabel: string; month: number }[];
  defaultMonth: number;
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [kind, setKind] = useState<PlanKind>("FESTIVAL");
  const [festivalId, setFestivalId] = useState("");
  const [workLabel, setWorkLabel] = useState("");
  const [format, setFormat] = useState<PlanFormat>("STORY");
  const [pending, startTransition] = useTransition();

  // This month's festivals first, then the rest of the calendar.
  const order = Array.from({ length: 12 }, (_, i) => ((defaultMonth - 1 + i) % 12) + 1);

  return (
    <form
      className="flex flex-wrap gap-2 items-center px-5 py-3.5 border-b"
      style={{ borderColor: "var(--border)" }}
      onSubmit={(e) => {
        e.preventDefault();
        const detail = kind === "FESTIVAL" ? festivalId : workLabel.trim();
        if (!brandId || !detail) {
          alert(kind === "FESTIVAL" ? "Pick a brand and a festival." : "Pick a brand and describe the work.");
          return;
        }
        startTransition(async () => {
          const r = await addPlannedEntry(monthKey, brandId, kind, detail, format);
          if (!r.ok) alert(r.error);
          else {
            setFestivalId("");
            setWorkLabel("");
          }
        });
      }}
    >
      <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="h-9 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Brand">
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as PlanKind)}
        className="h-9 rounded-lg border px-2 text-[11px]"
        style={inputStyle}
        aria-label="Type"
      >
        <option value="FESTIVAL">Festival</option>
        <option value="NON_IP">Non-IP work</option>
      </select>
      {kind === "FESTIVAL" ? (
        <select
          value={festivalId}
          onChange={(e) => setFestivalId(e.target.value)}
          className="h-9 rounded-lg border px-2 text-[11px] min-w-[260px]"
          style={inputStyle}
          aria-label="Festival"
        >
          <option value="">Choose a festival…</option>
          {order.map((m) => {
            const list = festivals.filter((f) => f.month === m);
            if (!list.length) return null;
            return (
              <optgroup key={m} label={MONTHS[m - 1]}>
                {list.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.dateLabel} — {f.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      ) : (
        <input
          type="text"
          value={workLabel}
          onChange={(e) => setWorkLabel(e.target.value)}
          placeholder="e.g. Teaser reel, Launch reel…"
          maxLength={120}
          className="h-9 rounded-lg border px-2.5 text-[11px] min-w-[260px]"
          style={inputStyle}
          aria-label="What work"
        />
      )}
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as PlanFormat)}
        className="h-9 rounded-lg border px-2 text-[11px]"
        style={inputStyle}
        aria-label="Format"
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {FORMAT_LABEL[f]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="h-9 rounded-lg px-3.5 text-[11px] font-semibold" style={{ ...primaryButtonStyle, opacity: pending ? 0.6 : 1 }}>
        + Add
      </button>
    </form>
  );
}
