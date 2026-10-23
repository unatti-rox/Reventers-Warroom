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
  allowEmpty = false,
  label,
}: {
  shootId: string;
  field: "date" | "dop" | "socialMediaPerson" | "remarks";
  value: string;
  editable: boolean;
  type?: "text" | "date";
  allowEmpty?: boolean;
  label: string;
}) {
  return <EditableText value={value} readOnly={!editable} allowEmpty={allowEmpty} type={type} label={label} onCommit={(v) => updateShoot(shootId, field, v)} />;
}

export function ShootIpCell({
  shootId,
  ipId,
  ips,
  editable,
}: {
  shootId: string;
  ipId: string;
  ips: { id: string; name: string }[];
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (!editable) {
    return <span>{ips.find((ip) => ip.id === ipId)?.name ?? "—"}</span>;
  }
  return (
    <select
      value={ipId}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const r = await updateShoot(shootId, "ipId", next);
          if (!r.ok) alert(r.error);
        });
      }}
      className="h-8 rounded-lg border px-2 text-[11px]"
      style={{ ...inputStyle, opacity: pending ? 0.6 : 1 }}
      aria-label="IP"
    >
      {ips.map((ip) => (
        <option key={ip.id} value={ip.id}>
          {ip.name}
        </option>
      ))}
    </select>
  );
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

export function AddShootForm({ cohorts, ips }: { cohorts: { id: string; label: string }[]; ips: { id: string; name: string }[] }) {
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [ipId, setIpId] = useState(ips[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [dop, setDop] = useState("");
  const [socialMediaPerson, setSocialMediaPerson] = useState("");
  const [remarks, setRemarks] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-2 items-center px-5 py-3.5 border-b"
      style={{ borderColor: "var(--border)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!cohortId || !ipId || !date || !dop.trim() || !socialMediaPerson.trim()) {
          alert("Fill in every field.");
          return;
        }
        startTransition(async () => {
          const r = await addShoot(cohortId, ipId, date, dop, socialMediaPerson, remarks);
          if (!r.ok) alert(r.error);
          else {
            setDate("");
            setDop("");
            setSocialMediaPerson("");
            setRemarks("");
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
      <select value={ipId} onChange={(e) => setIpId(e.target.value)} className="h-9 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="IP">
        {ips.map((ip) => (
          <option key={ip.id} value={ip.id}>
            {ip.name}
          </option>
        ))}
      </select>
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
      <input
        type="text"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Remarks (optional)"
        maxLength={300}
        className="h-9 rounded-lg border px-2.5 text-[11px] min-w-[160px] flex-1"
        style={inputStyle}
        aria-label="Remarks"
      />
      <button type="submit" disabled={pending} className="h-9 rounded-lg px-3.5 text-[11px] font-semibold" style={{ ...primaryButtonStyle, opacity: pending ? 0.6 : 1 }}>
        + Add shoot
      </button>
    </form>
  );
}
