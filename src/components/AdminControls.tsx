"use client";

import { useState, useTransition } from "react";
import { EditableNumber } from "@/components/EditableNumber";
import {
  addBrand,
  addCohort,
  addFestival,
  addIp,
  addIpMember,
  addPerson,
  removeIpMember,
  resetPassword,
  saveMonthSetting,
  saveTargetSettings,
  setBrandArchived,
  setCohortIps,
  setCohortLeader,
  updateBrand,
  updateFestival,
  updatePerson,
  type ActionResult,
} from "@/lib/actions";
import { inputStyle, primaryButtonStyle } from "@/components/ui";
import type { AppRole, PersonRole } from "@/generated/prisma/enums";

const control = "h-8 rounded-lg border px-2 text-[11px]";
const button = "h-8 rounded-lg px-3 text-[11px] font-semibold";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function useAction() {
  const [pending, startTransition] = useTransition();
  const go = (fn: () => Promise<ActionResult>, onOk?: (r: ActionResult & { ok: true }) => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
      else onOk?.(r);
    });
  return [pending, go] as const;
}

function Button({ children, pending, secondary, onClick, type = "submit" }: { children: React.ReactNode; pending?: boolean; secondary?: boolean; onClick?: () => void; type?: "submit" | "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending}
      className={`${button} ${secondary ? "border" : ""}`}
      style={secondary ? { borderColor: "var(--border)", color: "var(--brand-ink)", opacity: pending ? 0.6 : 1 } : { ...primaryButtonStyle, opacity: pending ? 0.6 : 1 }}
    >
      {children}
    </button>
  );
}

/* ---------------- TARGETS ---------------- */

export function TargetSettingsForm({ baseMonthly, perBrand }: { baseMonthly: number; perBrand: number }) {
  const [base, setBase] = useState(String(baseMonthly));
  const [per, setPer] = useState(String(perBrand));
  const [pending, go] = useAction();
  return (
    <form
      className="flex flex-wrap items-end gap-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => saveTargetSettings(Number(base), Number(per)), () => alert("Saved"));
      }}
    >
      <label className="text-[11px]">
        <span className="block font-semibold mb-1">Monthly IP base</span>
        <input type="number" min={0} value={base} onChange={(e) => setBase(e.target.value)} className={`${control} w-28`} style={inputStyle} />
      </label>
      <label className="text-[11px]">
        <span className="block font-semibold mb-1">Added per new brand</span>
        <input type="number" min={0} value={per} onChange={(e) => setPer(e.target.value)} className={`${control} w-28`} style={inputStyle} />
      </label>
      <Button pending={pending}>Save</Button>
    </form>
  );
}

export function MonthOverrideCell({ monthKey, field, value }: { monthKey: string; field: "baseOverride" | "achievedOverride"; value: number | null }) {
  return <EditableNumber value={value} allowEmpty placeholder="—  set" label={field} onCommit={(v) => saveMonthSetting(monthKey, field, v)} />;
}

/* ---------------- COHORTS & BRANDS ---------------- */

type Option = { id: string; label: string };

export function CohortLeaderSelect({ cohortId, current, people }: { cohortId: string; current: string | null; people: Option[] }) {
  const [pending, go] = useAction();
  return (
    <select
      value={current ?? ""}
      disabled={pending}
      onChange={(e) => go(() => setCohortLeader(cohortId, e.target.value))}
      className={control}
      style={inputStyle}
      aria-label="Cohort leader"
    >
      {!current && <option value="">Choose leader…</option>}
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

export function BrandRow({
  brand,
  cohorts,
}: {
  brand: { id: string; name: string; cohortId: string; archived: boolean; addedMonthKey: string | null };
  cohorts: Option[];
}) {
  const [name, setName] = useState(brand.name);
  const [cohortId, setCohortId] = useState(brand.cohortId);
  const [pending, go] = useAction();
  const dirty = name !== brand.name || cohortId !== brand.cohortId;
  return (
    <form
      className="flex flex-wrap items-center gap-1.5 py-1.5"
      style={{ opacity: brand.archived ? 0.55 : 1 }}
      onSubmit={(e) => {
        e.preventDefault();
        go(() => updateBrand(brand.id, name, cohortId));
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} className={`${control} w-44`} style={inputStyle} aria-label="Brand name" />
      <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={control} style={inputStyle} aria-label="Cohort">
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      {dirty && <Button pending={pending}>Save</Button>}
      <Button type="button" secondary pending={pending} onClick={() => go(() => setBrandArchived(brand.id, !brand.archived))}>
        {brand.archived ? "Restore" : "Archive"}
      </Button>
      {brand.addedMonthKey && (
        <span className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
          added {brand.addedMonthKey}
        </span>
      )}
    </form>
  );
}

export function AddBrandForm({ cohorts }: { cohorts: Option[] }) {
  const [name, setName] = useState("");
  const [cohortId, setCohortId] = useState(cohorts[0]?.id ?? "");
  const [pending, go] = useAction();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => addBrand(name, cohortId), () => setName(""));
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New brand name" className={`${control} w-48`} style={inputStyle} aria-label="New brand name" />
      <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={control} style={inputStyle} aria-label="Cohort">
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <Button pending={pending}>+ Add brand</Button>
    </form>
  );
}

export function AddCohortForm({ people }: { people: Option[] }) {
  const [code, setCode] = useState("");
  const [leader, setLeader] = useState("");
  const [pending, go] = useAction();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => addCohort(code, leader), () => setCode(""));
      }}
    >
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code, e.g. C8" className={`${control} w-28`} style={inputStyle} aria-label="Cohort code" />
      <select value={leader} onChange={(e) => setLeader(e.target.value)} className={control} style={inputStyle} aria-label="Cohort leader">
        <option value="">Leader…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <Button pending={pending}>+ Add cohort</Button>
    </form>
  );
}

/* ---------------- PEOPLE ---------------- */

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "COHORT_LEADER", label: "Cohort Leader" },
  { value: "IP_CS", label: "IP CS" },
  { value: "DESIGNER", label: "Designer" },
  { value: "EDITOR", label: "Editor" },
  { value: "FLOATER", label: "Floater" },
];

export function PersonRow({
  person,
}: {
  person: { id: string; name: string; appRole: AppRole; email: string | null; active: boolean; hasPassword: boolean; mustChangePassword: boolean };
}) {
  const [role, setRole] = useState(person.appRole);
  const [email, setEmail] = useState(person.email ?? "");
  const [active, setActive] = useState(person.active);
  const [temp, setTemp] = useState<string | null>(null);
  const [pending, go] = useAction();
  const dirty = role !== person.appRole || email !== (person.email ?? "") || active !== person.active;
  const loginState = !person.hasPassword ? "No login yet" : person.mustChangePassword ? "Temporary password issued" : "Signed up";
  return (
    <tr style={{ opacity: person.active ? 1 : 0.55 }}>
      <td className="px-3 py-2 border-b text-[11.5px] font-bold" style={{ borderColor: "var(--border)" }}>
        {person.name}
      </td>
      <td className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className={control} style={inputStyle} aria-label="Role">
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className={`${control} w-48`} style={inputStyle} aria-label="Email" />
      </td>
      <td className="px-3 py-2 border-b text-center" style={{ borderColor: "var(--border)" }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} aria-label="Active" />
      </td>
      <td className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center gap-1.5">
          {dirty && (
            <Button type="button" pending={pending} onClick={() => go(() => updatePerson(person.id, role, email, active))}>
              Save
            </Button>
          )}
          <Button
            type="button"
            secondary
            pending={pending}
            onClick={() => {
              if (!confirm(`Issue a new one-time password for ${person.name}? Their current password stops working.`)) return;
              go(() => resetPassword(person.id), (r) => setTemp(r.message ?? null));
            }}
          >
            {person.hasPassword ? "Reset password" : "Create login"}
          </Button>
          <span className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
            {loginState}
          </span>
        </div>
        {temp && (
          <div className="mt-1.5 text-[11px] rounded-md px-2 py-1" style={{ background: "var(--brand-soft)" }}>
            One-time password for {person.name}: <b className="font-mono select-all">{temp}</b> — share it with them; it won&apos;t be shown again.
          </div>
        )}
      </td>
    </tr>
  );
}

export function AddPersonForm() {
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("EDITOR");
  const [email, setEmail] = useState("");
  const [pending, go] = useAction();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => addPerson(name, role, email), () => {
          setName("");
          setEmail("");
        });
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={`${control} w-40`} style={inputStyle} aria-label="Name" />
      <select value={role} onChange={(e) => setRole(e.target.value as AppRole)} className={control} style={inputStyle} aria-label="Role">
        {ROLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className={`${control} w-48`} style={inputStyle} aria-label="Email" />
      <Button pending={pending}>+ Add person</Button>
    </form>
  );
}

/* ---------------- IP TEAMS ---------------- */

export function IpMemberChip({ assignmentId, label }: { assignmentId: string; label: string }) {
  const [pending, go] = useAction();
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 m-0.5 text-[10.5px]" style={{ background: "var(--brand-soft)", opacity: pending ? 0.5 : 1 }}>
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={() => {
          if (confirm(`Remove ${label} from this IP?`)) go(() => removeIpMember(assignmentId));
        }}
        style={{ color: "var(--brand-ink)" }}
      >
        ✕
      </button>
    </span>
  );
}

export function AddIpMemberForm({ ipId, people }: { ipId: string; people: Option[] }) {
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<PersonRole>("EDITOR");
  const [pending, go] = useAction();
  return (
    <form
      className="flex flex-wrap items-center gap-1.5 mt-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!personId) return;
        go(() => addIpMember(ipId, personId, role), () => setPersonId(""));
      }}
    >
      <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={control} style={inputStyle} aria-label="Person">
        <option value="">Add person…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <select value={role} onChange={(e) => setRole(e.target.value as PersonRole)} className={control} style={inputStyle} aria-label="Role on this IP">
        <option value="IP_CS">IP CS</option>
        <option value="DESIGNER">Designer</option>
        <option value="EDITOR">Editor</option>
      </select>
      <Button pending={pending}>Add</Button>
    </form>
  );
}

export function AddIpForm() {
  const [name, setName] = useState("");
  const [pending, go] = useAction();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => addIp(name), () => setName(""));
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New IP name" className={`${control} w-56`} style={inputStyle} aria-label="IP name" />
      <Button pending={pending}>+ Add IP</Button>
    </form>
  );
}

/** Sets a cohort's fixed IPs (checkboxes), replacing weekly rotation. */
export function CohortIpsForm({ cohortId, allIps, selected }: { cohortId: string; allIps: Option[]; selected: string[] }) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [pending, go] = useAction();
  const dirty = picked.length !== selected.length || picked.some((id) => !selected.includes(id));
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1.5">
      {allIps.map((ip) => {
        const on = picked.includes(ip.id);
        return (
          <button
            key={ip.id}
            type="button"
            onClick={() => setPicked((p) => (on ? p.filter((id) => id !== ip.id) : [...p, ip.id]))}
            className="text-[10.5px] font-semibold rounded-full px-2.5 py-1 border"
            style={{
              borderColor: on ? "var(--brand-ink)" : "var(--border)",
              background: on ? "var(--brand-ink)" : "transparent",
              color: on ? "#fff" : "var(--text-secondary)",
            }}
          >
            {ip.label}
          </button>
        );
      })}
      {dirty && (
        <Button type="button" pending={pending} onClick={() => go(() => setCohortIps(cohortId, picked))}>
          Save IPs
        </Button>
      )}
    </div>
  );
}

/* ---------------- FESTIVALS ---------------- */

export function FestivalRow({ festival }: { festival: { id: string; name: string; month: number; dateLabel: string; active: boolean } }) {
  const [name, setName] = useState(festival.name);
  const [month, setMonth] = useState(festival.month);
  const [date, setDate] = useState(festival.dateLabel);
  const [pending, go] = useAction();
  const dirty = name !== festival.name || month !== festival.month || date !== festival.dateLabel;
  return (
    <form
      className="flex flex-wrap items-center gap-1.5 py-1"
      style={{ opacity: festival.active ? 1 : 0.5 }}
      onSubmit={(e) => {
        e.preventDefault();
        go(() => updateFestival(festival.id, month, date, name, festival.active));
      }}
    >
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={control} style={inputStyle} aria-label="Month">
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <input value={date} onChange={(e) => setDate(e.target.value)} className={`${control} w-24`} style={inputStyle} aria-label="Date" />
      <input value={name} onChange={(e) => setName(e.target.value)} className={`${control} w-72`} style={inputStyle} aria-label="Festival" />
      {dirty && <Button pending={pending}>Save</Button>}
      <Button type="button" secondary pending={pending} onClick={() => go(() => updateFestival(festival.id, month, date, name, !festival.active))}>
        {festival.active ? "Hide" : "Show"}
      </Button>
    </form>
  );
}

export function AddFestivalForm() {
  const [name, setName] = useState("");
  const [month, setMonth] = useState(1);
  const [date, setDate] = useState("");
  const [pending, go] = useAction();
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => addFestival(month, date, name), () => {
          setName("");
          setDate("");
        });
      }}
    >
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={control} style={inputStyle} aria-label="Month">
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Date, e.g. 8 Nov" className={`${control} w-28`} style={inputStyle} aria-label="Date" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Festival name" className={`${control} w-60`} style={inputStyle} aria-label="Festival name" />
      <Button pending={pending}>+ Add festival</Button>
    </form>
  );
}
