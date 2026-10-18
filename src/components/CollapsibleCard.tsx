"use client";

import { useState } from "react";

/** A card that starts collapsed, showing only a title + one summary number, until clicked open. */
export function CollapsibleCard({
  title,
  subtitle,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border mb-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-[12.5px] font-bold truncate">{title}</div>
          {subtitle ? (
            <div className="text-[9.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {meta ? (
            <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--text-muted)" }}>
              {meta}
            </span>
          ) : null}
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>
      {open ? (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
