"use client";

import { useState, useTransition } from "react";
import { EditableNumber } from "@/components/EditableNumber";
import { setBrandIpTarget, logPlannedPiece, markPlannedLive, undoPlannedPiece, type ActionResult } from "@/lib/actions";
import { inputStyle, primaryButtonStyle } from "@/components/ui";
import type { PlanFormat } from "@/generated/prisma/enums";

/** The one number cohort leaders still set ahead of time: a brand's monthly target for one IP. */
export function TargetCell({ monthKey, brandId, ipId, value, label }: { monthKey: string; brandId: string; ipId: string; value: number; label: string }) {
  return <EditableNumber value={value} label={label} onCommit={(v) => setBrandIpTarget(monthKey, brandId, ipId, v ?? 0)} />;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FORMATS: PlanFormat[] = ["STORY", "REEL", "AV", "GIF"];
export const FORMAT_LABEL: Record<PlanFormat, string> = { STORY: "Story", REEL: "Reel", AV: "AV", GIF: "GIF" };

const BTN = "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide disabled:opacity-40";

/** One already-started Festive/Non-IP row: log another, mark one live, or undo the last tap. */
export function PlannedPieceRow({
  monthKey,
  brandId,
  kind,
  detail,
  format,
  label,
  achieved,
  live,
}: {
  monthKey: string;
  brandId: string;
  kind: "FESTIVAL" | "NON_IP";
  detail: string;
  format: PlanFormat;
  label: string;
  achieved: number;
  live: number;
}) {
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<ActionResult>) => () =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
    });
  return (
    <div className="flex items-center gap-2 flex-wrap px-5 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
      <div className="flex-1 min-w-0 text-[12px] font-bold truncate">
        {label}
        <span className="ml-1.5 font-normal text-[10px]" style={{ color: "var(--text-muted)" }}>
          {FORMAT_LABEL[format]}
        </span>
      </div>
      <span className="tabular-nums text-[12px] font-bold">{achieved}</span>
      <span className="tabular-nums text-[10px]" style={{ color: "var(--text-muted)" }}>
        {live} live
      </span>
      <button type="button" disabled={pending} onClick={act(() => logPlannedPiece(monthKey, brandId, kind, detail, format))} className={BTN} style={{ background: "var(--brand-ink)", color: "#fff" }}>
        Log it
      </button>
      <button
        type="button"
        disabled={pending || achieved <= live}
        onClick={act(() => markPlannedLive(monthKey, brandId, kind, detail, format))}
        className={BTN}
        style={{ background: "var(--status-good-bg)", color: "var(--text-primary)" }}
      >
        Mark live
      </button>
      <button type="button" disabled={pending || achieved === 0} onClick={act(() => undoPlannedPiece(monthKey, brandId, kind, detail, format))} className={BTN} style={{ background: "var(--surface-tint)", color: "var(--text-secondary)" }}>
        Undo
      </button>
    </div>
  );
}

/** Starts a brand-new Festive or Non-IP piece — logging the first one is how a new row is added. */
export function AddPlannedPieceForm({
  monthKey,
  brandId,
  festivals,
}: {
  monthKey: string;
  brandId: string;
  festivals: { id: string; name: string; dateLabel: string; month: number }[];
}) {
  const [kind, setKind] = useState<"FESTIVAL" | "NON_IP">("FESTIVAL");
  const [festivalId, setFestivalId] = useState("");
  const [workLabel, setWorkLabel] = useState("");
  const [format, setFormat] = useState<PlanFormat>("STORY");
  const [pending, startTransition] = useTransition();
  const defaultMonth = Number(monthKey.slice(5, 7));
  const order = Array.from({ length: 12 }, (_, i) => ((defaultMonth - 1 + i) % 12) + 1);

  return (
    <form
      className="flex flex-wrap gap-2 items-center px-5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        const detail = kind === "FESTIVAL" ? festivalId : workLabel.trim();
        if (!detail) {
          alert(kind === "FESTIVAL" ? "Pick a festival." : "Describe the work.");
          return;
        }
        startTransition(async () => {
          const r = await logPlannedPiece(monthKey, brandId, kind, detail, format);
          if (!r.ok) alert(r.error);
          else {
            setFestivalId("");
            setWorkLabel("");
          }
        });
      }}
    >
      <select value={kind} onChange={(e) => setKind(e.target.value as "FESTIVAL" | "NON_IP")} className="h-8 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Type">
        <option value="FESTIVAL">Festival</option>
        <option value="NON_IP">Non-IP work</option>
      </select>
      {kind === "FESTIVAL" ? (
        <select value={festivalId} onChange={(e) => setFestivalId(e.target.value)} className="h-8 rounded-lg border px-2 text-[11px] min-w-[220px]" style={inputStyle} aria-label="Festival">
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
          className="h-8 rounded-lg border px-2.5 text-[11px] min-w-[220px]"
          style={inputStyle}
          aria-label="What work"
        />
      )}
      <select value={format} onChange={(e) => setFormat(e.target.value as PlanFormat)} className="h-8 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Format">
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {FORMAT_LABEL[f]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="h-8 rounded-lg px-3 text-[11px] font-semibold" style={{ ...primaryButtonStyle, opacity: pending ? 0.6 : 1 }}>
        Log it
      </button>
    </form>
  );
}
