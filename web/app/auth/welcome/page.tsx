export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAuthUser, createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import WelcomeClient from "./welcome-client";

export default async function WelcomePage() {
  const user = await getAuthUser();
  if (!user) redirect("/");

  // Already has a pending or approved claim — go straight to profile.
  const serverClient = await createSupabaseServerClient();
  const { data: claims } = await serverClient
    .from("runner_claims")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["approved", "pending"]);

  if (claims?.length) redirect("/profile");

  // No claim yet — find runner profiles matching their name.
  const fullName = user.user_metadata?.full_name as string | undefined;
  if (!fullName) redirect("/profile");

  const { data: runners } = await supabase
    .from("runners")
    .select("id, full_name, country, city")
    .ilike("full_name", fullName)
    .eq("is_hidden", false)
    .limit(5);

  if (!runners?.length) redirect("/profile");

  return <WelcomeClient matches={runners} />;
}
