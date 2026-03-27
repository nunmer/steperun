import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Returns unclaimed runners whose full_name matches the query (case-insensitive)
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json([]);

  const { data } = await supabase
    .from("runners")
    .select("id, full_name, country, city, claimed_by")
    .ilike("full_name", name)
    .eq("is_hidden", false)
    .is("claimed_by", null)
    .limit(5);

  return NextResponse.json(data ?? []);
}
