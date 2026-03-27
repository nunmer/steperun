import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { getClaim } from "@/lib/services/claims";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const claim = await getClaim(Number(id), user.id);
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(claim);
}
