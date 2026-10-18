"use client";

import { EditableNumber } from "@/components/EditableNumber";
import { setBrandIpValue } from "@/lib/actions";

export function BrandIpNumberCell({
  monthKey,
  brandId,
  ipId,
  field,
  value,
  label,
}: {
  monthKey: string;
  brandId: string;
  ipId: string;
  field: "target" | "achieved" | "live";
  value: number;
  label: string;
}) {
  return <EditableNumber value={value} label={label} onCommit={(v) => setBrandIpValue(monthKey, brandId, ipId, field, v ?? 0)} />;
}
