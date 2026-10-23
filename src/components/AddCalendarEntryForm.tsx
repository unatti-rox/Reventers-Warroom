"use client";

import { useState, useTransition } from "react";
import { addCalendarEntry } from "@/lib/actions";
import { inputStyle, primaryButtonStyle } from "@/components/ui";
import type { EntryKind, PlanFormat } from "@/generated/prisma/enums";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FORMATS: PlanFormat[] = ["STORY", "REEL", "AV", "GIF"];
export const FORMAT_LABEL: Record<PlanFormat, string> = { STORY: "Story", REEL: "Reel", AV: "AV", GIF: "GIF" };

/** Plans one post: pick what kind it is, describe it, and say when it goes live. Logging the first one is how a brand's plan for the month gets built. */
export function AddCalendarEntryForm({
  brandId,
  ips,
  festivals,
  defaultMonth,
}: {
  brandId: string;
  ips: { id: string; name: string }[];
  festivals: { id: string; name: string; dateLabel: string; month: number }[];
  defaultMonth: number;
}) {
  const [kind, setKind] = useState<EntryKind>("REGULAR");
  const [ipId, setIpId] = useState(ips[0]?.id ?? "");
  const [festivalId, setFestivalId] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<PlanFormat>("STORY");
  const [postDate, setPostDate] = useState("");
  const [pending, startTransition] = useTransition();
  const order = Array.from({ length: 12 }, (_, i) => ((defaultMonth - 1 + i) % 12) + 1);

  return (
    <form
      className="flex flex-wrap gap-2 items-center px-5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!postDate) {
          alert("Pick the date this is meant to go live.");
          return;
        }
        if (!title.trim()) {
          alert("Give it a short title.");
          return;
        }
        if (kind === "REGULAR" && !ipId) {
          alert("Pick an IP.");
          return;
        }
        if (kind === "FESTIVAL" && !festivalId) {
          alert("Pick a festival.");
          return;
        }
        startTransition(async () => {
          const r = await addCalendarEntry({
            brandId,
            kind,
            ipId: kind === "REGULAR" ? ipId : undefined,
            festivalId: kind === "FESTIVAL" ? festivalId : undefined,
            title: title.trim(),
            format: kind === "REGULAR" ? undefined : format,
            postDate,
          });
          if (!r.ok) alert(r.error);
          else {
            setTitle("");
            setPostDate("");
          }
        });
      }}
    >
      <select value={kind} onChange={(e) => setKind(e.target.value as EntryKind)} className="h-8 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Type">
        <option value="REGULAR">IP</option>
        <option value="FESTIVAL">Festival</option>
        <option value="NON_IP">Non-IP work</option>
      </select>
      {kind === "REGULAR" && (
        <select value={ipId} onChange={(e) => setIpId(e.target.value)} className="h-8 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="IP">
          {ips.length === 0 && <option value="">No IPs fixed to this cohort</option>}
          {ips.map((ip) => (
            <option key={ip.id} value={ip.id}>
              {ip.name}
            </option>
          ))}
        </select>
      )}
      {kind === "FESTIVAL" && (
        <select value={festivalId} onChange={(e) => setFestivalId(e.target.value)} className="h-8 rounded-lg border px-2 text-[11px] min-w-[200px]" style={inputStyle} aria-label="Festival">
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
      )}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Teaser reel"
        maxLength={120}
        className="h-8 rounded-lg border px-2.5 text-[11px] min-w-[160px]"
        style={inputStyle}
        aria-label="Title"
      />
      {kind !== "REGULAR" && (
        <select value={format} onChange={(e) => setFormat(e.target.value as PlanFormat)} className="h-8 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Format">
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
      )}
      <input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} className="h-8 rounded-lg border px-2 text-[11px]" style={inputStyle} aria-label="Post date" />
      <button type="submit" disabled={pending} className="h-8 rounded-lg px-3 text-[11px] font-semibold" style={{ ...primaryButtonStyle, opacity: pending ? 0.6 : 1 }}>
        + Plan it
      </button>
    </form>
  );
}
