import { createHash } from "node:crypto";

/**
 * A stable ICCID-style number derived from the account id, so a customer sees
 * the same "SIM number" every visit. Fictional: no SIM card exists.
 */
export function fictionalIccid(userId: string): string {
  const digits = BigInt(`0x${createHash("sha256").update(`jsc:${userId}`).digest("hex").slice(0, 16)}`)
    .toString()
    .padStart(15, "7")
    .slice(0, 15);
  return `8965${digits}`.replace(/(.{4})(?=.)/g, "$1 ");
}
