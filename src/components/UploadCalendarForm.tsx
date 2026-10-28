"use client";

import { useState, useTransition } from "react";
import { parseCalendarScreenshot, addCalendarEntry } from "@/lib/actions";
import { inputStyle, primaryButtonStyle } from "@/components/ui";
import { FORMATS, FORMAT_LABEL, BucketOptions, type BucketOption } from "@/components/AddCalendarEntryForm";
import type { EntryKind, PlanFormat } from "@/generated/prisma/enums";

const FESTIVAL = "festival";
const ipValue = (id: string) => `ip:${id}`;

type DraftRow = {
  key: string;
  title: string;
  /** "" (needs a pick - the AI's guess didn't match anything), "ip:<id>", "festival", or "nonip". */
  bucket: string;
  ipNameGuess: string | null;
  festivalId: string | null;
  festivalNameGuess: string | null;
  format: PlanFormat;
  postDate: string;
};

const errorStyle = { ...inputStyle, borderColor: "var(--status-critical)" };

function bucketToKind(bucket: string): EntryKind {
  if (bucket === FESTIVAL) return "FESTIVAL";
  return "REGULAR";
}

/** Upload a photo of the brand's calendar - the AI reads it and drafts posts here for a quick check before anything's saved. */
export function UploadCalendarForm({
  brandId,
  monthKey,
  ips,
  festivals,
}: {
  brandId: string;
  monthKey: string;
  ips: BucketOption[];
  festivals: { id: string; name: string }[];
}) {
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
  const [parsing, startParsing] = useTransition();
  const [confirming, startConfirming] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) {
      alert("That image is too large — try a screenshot under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      const header = result.slice(0, comma);
      const data = result.slice(comma + 1);
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? "image/png";
      startParsing(async () => {
        const r = await parseCalendarScreenshot(brandId, data, mediaType, monthKey);
        if (!r.ok) {
          alert(r.error);
          return;
        }
        setDrafts(
          r.entries.map((entry, i) => ({
            key: `${Date.now()}-${i}`,
            title: entry.title,
            bucket: entry.kind === "REGULAR" ? (entry.ipId ? ipValue(entry.ipId) : "") : entry.kind === "FESTIVAL" ? FESTIVAL : "",
            ipNameGuess: entry.ipNameGuess,
            festivalId: entry.festivalId,
            festivalNameGuess: entry.festivalNameGuess,
            format: "REEL" as PlanFormat,
            postDate: entry.postDate ?? "",
          })),
        );
      });
    };
    reader.readAsDataURL(file);
  }

  function update(key: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev?.map((d) => (d.key === key ? { ...d, ...patch } : d)) ?? null);
  }

  function remove(key: string) {
    setDrafts((prev) => prev?.filter((d) => d.key !== key) ?? null);
  }

  const allValid = (drafts ?? []).every((d) => d.postDate && d.title.trim() && d.bucket && (bucketToKind(d.bucket) !== "FESTIVAL" || d.festivalId));

  function confirmAll() {
    if (!drafts || drafts.length === 0) return;
    startConfirming(async () => {
      for (const d of drafts) {
        const kind = bucketToKind(d.bucket);
        const r = await addCalendarEntry({
          brandId,
          kind,
          ipId: kind === "REGULAR" ? d.bucket.slice(3) : undefined,
          festivalId: kind === "FESTIVAL" ? (d.festivalId ?? undefined) : undefined,
          title: d.title,
          format: kind === "REGULAR" ? undefined : d.format,
          postDate: d.postDate,
        });
        if (!r.ok) {
          alert(`"${d.title}" — ${r.error}`);
          return;
        }
      }
      setDrafts(null);
    });
  }

  if (!drafts) {
    return (
      <label
        className="inline-flex items-center gap-2 h-8 rounded-lg border px-3 text-[11px] font-semibold cursor-pointer"
        style={{ borderColor: "var(--border)", color: "var(--brand-ink)", opacity: parsing ? 0.6 : 1 }}
      >
        {parsing ? "Reading calendar…" : "Upload a calendar screenshot"}
        <input type="file" accept="image/*" className="hidden" disabled={parsing} onChange={onFile} />
      </label>
    );
  }

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
        Found {drafts.length} planned post{drafts.length === 1 ? "" : "s"} — check these before confirming
      </div>
      {drafts.map((d) => {
        const kind = bucketToKind(d.bucket);
        return (
          <div key={d.key} className="flex flex-wrap items-center gap-1.5 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
            <select value={d.bucket} onChange={(e) => update(d.key, { bucket: e.target.value })} className="h-7 rounded border px-1.5 text-[10.5px] min-w-[150px]" style={d.bucket ? inputStyle : errorStyle} aria-label="Bucket">
              <option value="">{d.ipNameGuess ? `"${d.ipNameGuess}" — pick one` : "Pick a bucket…"}</option>
              <BucketOptions ips={ips} />
            </select>
            {kind === "FESTIVAL" && (
              <select
                value={d.festivalId ?? ""}
                onChange={(e) => update(d.key, { festivalId: e.target.value || null })}
                className="h-7 rounded border px-1.5 text-[10.5px] min-w-[160px]"
                style={d.festivalId ? inputStyle : errorStyle}
                aria-label="Which festival"
              >
                <option value="">{d.festivalNameGuess ? `"${d.festivalNameGuess}" — pick one` : "Pick a festival…"}</option>
                {festivals.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            {kind !== "REGULAR" && (
              <select value={d.format} onChange={(e) => update(d.key, { format: e.target.value as PlanFormat })} className="h-7 rounded border px-1.5 text-[10.5px]" style={inputStyle} aria-label="Format">
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
            )}
            <input value={d.title} onChange={(e) => update(d.key, { title: e.target.value })} className="h-7 rounded border px-1.5 text-[10.5px] flex-1 min-w-[120px]" style={inputStyle} aria-label="Title" />
            <input
              type="date"
              value={d.postDate}
              onChange={(e) => update(d.key, { postDate: e.target.value })}
              className="h-7 rounded border px-1.5 text-[10.5px]"
              style={d.postDate ? inputStyle : errorStyle}
              aria-label="Post date"
            />
            <button type="button" onClick={() => remove(d.key)} className="text-[12px] px-1" style={{ color: "var(--status-critical)" }} aria-label="Remove">
              ✕
            </button>
          </div>
        );
      })}
      <div className="flex items-center gap-2 flex-wrap mt-2.5">
        <button
          type="button"
          disabled={confirming || !allValid || drafts.length === 0}
          onClick={confirmAll}
          className="h-8 rounded-lg px-3 text-[11px] font-semibold disabled:opacity-40"
          style={primaryButtonStyle}
        >
          {confirming ? "Adding…" : `Confirm ${drafts.length} post${drafts.length === 1 ? "" : "s"}`}
        </button>
        <button type="button" disabled={confirming} onClick={() => setDrafts(null)} className="h-8 rounded-lg px-3 text-[11px] font-semibold border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          Cancel
        </button>
        {!allValid && (
          <span className="text-[10px]" style={{ color: "var(--status-critical)" }}>
            Fix the highlighted fields first
          </span>
        )}
      </div>
    </div>
  );
}
