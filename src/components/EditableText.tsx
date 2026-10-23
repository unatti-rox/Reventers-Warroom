"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions";

/**
 * A text value that becomes an input on click and saves on Enter / blur.
 * With `readOnly` it's plain text.
 */
export function EditableText({
  value,
  onCommit,
  readOnly = false,
  allowEmpty = false,
  type = "text",
  placeholder = "—",
  label,
}: {
  value: string;
  onCommit: (value: string) => Promise<ActionResult>;
  readOnly?: boolean;
  allowEmpty?: boolean;
  type?: "text" | "date";
  placeholder?: string;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  if (readOnly) {
    return <span>{value || placeholder}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="underline decoration-dotted underline-offset-2 cursor-text text-left"
        style={{ color: "var(--text-primary)", background: "none", border: "none", font: "inherit", padding: 0, opacity: pending ? 0.5 : 1 }}
        title="Click to edit"
        aria-label={label ? `Edit ${label}` : undefined}
      >
        {value || placeholder}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed && !allowEmpty) return;
    if (trimmed === value) return;
    startTransition(async () => {
      const result = await onCommit(trimmed);
      if (!result.ok) alert(result.error);
    });
  };

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
      className="rounded border px-1.5 py-0.5 text-[11px]"
      style={{ borderColor: "var(--brand-ink)", background: "var(--surface-raised)", color: "var(--text-primary)", minWidth: type === "date" ? 130 : 120 }}
    />
  );
}
