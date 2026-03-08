import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const { data } = await supabase
    .from("runners")
    .select("id, full_name, country, city")
    .eq("is_hidden", false)
    .ilike("full_name", `%${q}%`)
    .order("full_name")
    .limit(10);

  return NextResponse.json(data ?? []);
}
