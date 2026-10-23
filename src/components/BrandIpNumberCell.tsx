"use client";

import { EditableNumber } from "@/components/EditableNumber";
import { setBrandIpTarget } from "@/lib/actions";

/** Click-to-edit target for a brand + IP + month. Achieved/live are logged, not typed — see PieceLogControls. */
export function BrandIpNumberCell({
  monthKey,
  brandId,
  ipId,
  value,
  label,
}: {
  monthKey: string;
  brandId: string;
  ipId: string;
  value: number;
  label: string;
}) {
  return <EditableNumber value={value} label={label} onCommit={(v) => setBrandIpTarget(monthKey, brandId, ipId, v ?? 0)} />;
}
