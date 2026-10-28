import { EntryStatus } from "@/generated/prisma/enums";

/** Dropdown order on Log it. */
export const STATUS_OPTIONS: EntryStatus[] = [EntryStatus.WIP, EntryStatus.ATR, EntryStatus.CTR, EntryStatus.LIVE, EntryStatus.REJECTED];

export const STATUS_LABEL: Record<EntryStatus, string> = {
  WIP: "WIP",
  ATR: "ATR",
  CTR: "CTR",
  LIVE: "Live",
  REJECTED: "Rejected",
};

export const STATUS_MEANING: Record<EntryStatus, string> = {
  WIP: "Work in progress",
  ATR: "Agency to revert",
  CTR: "Client to revert",
  LIVE: "Live",
  REJECTED: "Rejected",
};

export const STATUS_COLOR: Record<EntryStatus, string> = {
  WIP: "var(--text-muted)",
  ATR: "var(--status-warning)",
  CTR: "var(--series-2)",
  LIVE: "var(--status-good)",
  REJECTED: "var(--status-critical)",
};

/** Made and with the client, or posted: counts as delivered on the dashboard. */
export const DELIVERED: EntryStatus[] = [EntryStatus.CTR, EntryStatus.LIVE];

/** Still needs work from the team: shows on IP CS task lists and weekly load. */
export const OPEN: EntryStatus[] = [EntryStatus.WIP, EntryStatus.ATR, EntryStatus.CTR];

export function isDelivered(status: EntryStatus) {
  return DELIVERED.includes(status);
}

/** Rejected posts drop out of the plan entirely. */
export function isPlanned(status: EntryStatus) {
  return status !== EntryStatus.REJECTED;
}
