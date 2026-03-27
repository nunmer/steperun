import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase-server";
import { getMyClaims } from "@/lib/services/claims";

export async function GET(_request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const claims = await getMyClaims(user.id);
  return NextResponse.json(claims);
}
