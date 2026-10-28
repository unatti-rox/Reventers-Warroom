/** The IP buckets that need a shoot - the only ones offered on the Shoot Schedule. */
export const SHOOT_IP_NAMES = ["Events", "Bytes / Team Culture", "Sample Flat Photoshoot", "Living It", "Construction", "Location"];

export function isShootIp(name: string) {
  return SHOOT_IP_NAMES.includes(name);
}
