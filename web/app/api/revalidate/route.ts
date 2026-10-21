import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { invalidateAllResults } from "@/lib/cache";

/**
 * POST /api/revalidate — purge cached race data after the scraper imports
 * results. Called by .github/workflows/scrape-results.yml with
 * `Authorization: Bearer $REVALIDATE_SECRET`.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  invalidateAllResults();
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
