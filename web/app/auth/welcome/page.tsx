import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import WelcomeClient from "./welcome-client";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await getAuthUser();
  if (!user) redirect("/");

  // If already has an active claim, go straight to profile
  const { data: claims } = await supabase
    .from("runner_claims")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["approved", "pending"]);

  if (claims && claims.length > 0) {
    redirect("/profile");
  }

  // Find unclaimed runners matching the user's Google display name
  const fullName = user.user_metadata?.full_name as string | undefined;
  if (!fullName) redirect("/profile");

  const { data: matches } = await supabase
    .from("runners")
    .select("id, full_name, country, city")
    .ilike("full_name", fullName)
    .eq("is_hidden", false)
    .is("claimed_by", null)
    .limit(5);

  if (!matches || matches.length === 0) redirect("/profile");

  return <WelcomeClient matches={matches} />;
}
