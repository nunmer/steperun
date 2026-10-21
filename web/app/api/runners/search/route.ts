import { NextRequest, NextResponse } from "next/server";
import { searchRunnersQuick } from "@/lib/queries";

/** GET /api/runners/search?q= — nav search box (Latin/Cyrillic tolerant, cached). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 80);
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }
  const rows = await searchRunnersQuick(q.toLowerCase());
  return NextResponse.json(rows, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
