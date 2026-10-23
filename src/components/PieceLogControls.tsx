"use client";

import { useTransition } from "react";
import { logPiece, markOneLive, undoLastPiece, type ActionResult } from "@/lib/actions";

const BTN = "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide disabled:opacity-40";

/**
 * Replaces typing an achieved/live number: tap "Log it" each time a piece is
 * made, "Mark live" once it's posted, "Undo" to fix an accidental tap. The
 * counts below are just how many times someone tapped.
 */
export function PieceLogControls({
  monthKey,
  brandId,
  ipId,
  achieved,
  live,
  label,
}: {
  monthKey: string;
  brandId: string;
  ipId: string;
  achieved: number;
  live: number;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<ActionResult>) => () => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) alert(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <span className="tabular-nums text-[12px] font-bold" aria-label={`${label} achieved`}>
        {achieved}
      </span>
      <span className="tabular-nums text-[10px]" style={{ color: "var(--text-muted)" }} aria-label={`${label} live`}>
        {live} live
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={act(() => logPiece(monthKey, brandId, ipId))}
        className={BTN}
        style={{ background: "var(--brand-ink)", color: "#fff" }}
        aria-label={`Log a piece for ${label}`}
      >
        Log it
      </button>
      <button
        type="button"
        disabled={pending || achieved <= live}
        onClick={act(() => markOneLive(monthKey, brandId, ipId))}
        className={BTN}
        style={{ background: "var(--status-good-bg)", color: "var(--text-primary)" }}
        aria-label={`Mark one piece live for ${label}`}
      >
        Mark live
      </button>
      <button
        type="button"
        disabled={pending || achieved === 0}
        onClick={act(() => undoLastPiece(monthKey, brandId, ipId))}
        className={BTN}
        style={{ background: "var(--surface-tint)", color: "var(--text-secondary)" }}
        aria-label={`Undo the last logged piece for ${label}`}
      >
        Undo
      </button>
    </div>
  );
}
