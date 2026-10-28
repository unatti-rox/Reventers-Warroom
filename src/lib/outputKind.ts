import { EntryKind, IpCategory } from "@/generated/prisma/enums";

/** Which dashboard card a post counts toward. */
export type OutputKind = "ip" | "nonIp" | "festive";

/**
 * Festival posts are Festive and old Non-IP posts are Non-IP; a post
 * planned against a content bucket follows the bucket's category.
 */
export function outputKindOf(e: { kind: EntryKind; ip?: { category: IpCategory } | null }): OutputKind {
  if (e.kind === EntryKind.FESTIVAL) return "festive";
  if (e.kind === EntryKind.NON_IP) return "nonIp";
  if (e.ip?.category === IpCategory.NON_IP) return "nonIp";
  if (e.ip?.category === IpCategory.FESTIVE) return "festive";
  return "ip";
}
