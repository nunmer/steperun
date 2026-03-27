import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { getDispute } from "@/lib/services/disputes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dispute = await getDispute(Number(id), user.id);
  if (!dispute) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(dispute);
}
