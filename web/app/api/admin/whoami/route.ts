import { NextResponse } from "next/server";

/**
 * GET /api/admin/whoami — 200 for admins. proxy.ts answers 401/403 for
 * everyone else before this runs; the nav uses it to show the Admin link.
 */
export function GET() {
  return NextResponse.json({ admin: true }, { headers: { "Cache-Control": "private, no-store" } });
}
