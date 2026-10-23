"use client";

import { useState, useTransition } from "react";
import { EditableText } from "@/components/EditableText";
import { addShoot, removeShoot, updateShoot } from "@/lib/actions";
import { inputStyle, primaryButtonStyle } from "@/components/ui";

export function ShootTextCell({
  shootId,
  field,
  value,
  editable,
  type = "text",
  label,
}: {
  shootId: string;
  field: "detail" | "date" | "dop" | "socialMediaPerson";
  value: string;
  editable: boolean;
  type?: "text" | "date";
  label: string;
}) {
  return <EditableText value={value} readOnly={!editable} type={type} label={label} onCommit={(v) => updateShoot(shootId, field, v)} />;
}

export function RemoveShootButton({ shootId }: { shootId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Remove this shoot"
      aria-label="Remove"
      onClick={() => {
        if (!confirm("Remove this shoot?")) return;
        startTransition(async () => {
          const r = await removeShoot(shootId);
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

export function AddShootForm({ cohorts }: { cohorts: { id: string; label: string }[] }) {
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState("");
  const [dop, setDop] = useState("");
  const [socialMediaPerson, setSocialMediaPerson] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2 items-center px-5 py-3.5 border-b"
      style={{ borderColor: "var(--border)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!cohortId || !detail.trim() || !date || !dop.trim() || !socialMediaPerson.trim()) {
          alert("Fill in every field.");
          return;
        }
        startTransition(async () => {
          const r = await addShoot(cohortId, detail, date, dop, socialMediaPerson);
          if (!r.ok) alert(r.error);
          else {
            setDetail("");
            setDate("");
            setDop("");
            setSocialMediaPerson("");
          }
        });
      }}
    >
      <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="h-9 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Cohort">
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Shoot detail"
        maxLength={300}
        className="h-9 rounded-lg border px-2.5 text-[11px] min-w-[200px] flex-1"
        style={inputStyle}
        aria-label="Shoot detail"
      />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Date" />
      <input
        type="text"
        value={dop}
        onChange={(e) => setDop(e.target.value)}
        placeholder="DOP"
        className="h-9 rounded-lg border px-2.5 text-[11px] min-w-[120px]"
        style={inputStyle}
        aria-label="DOP"
      />
      <input
        type="text"
        value={socialMediaPerson}
        onChange={(e) => setSocialMediaPerson(e.target.value)}
        placeholder="Social media person"
        className="h-9 rounded-lg border px-2.5 text-[11px] min-w-[160px]"
        style={inputStyle}
        aria-label="Social media person"
      />
      <button type="submit" disabled={pending} className="h-9 rounded-lg px-3.5 text-[11px] font-semibold" style={{ ...primaryButtonStyle, opacity: pending ? 0.6 : 1 }}>
        + Add shoot
      </button>
    </form>
  );
}
