import { isIP } from "node:net";

/**
 * The caller's IP for audit and rate-limit rows, or undefined.
 *
 * Those columns are Postgres INET, and x-forwarded-for can be a list
 * ("client, proxy") or missing. Passing the raw header made every insert
 * fail, so only the first entry is used, and only if it is a valid address.
 */
export function clientIp(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : undefined;
}
