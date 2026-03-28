export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { getRunner } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function ProfilePage() {
  const user = await getAuthUser();
  if (!user) redirect("/");


  const { data: claim } = await supabase
    .from("runner_claims")
    .select("runner_id, status")
    .eq("user_id", user.id)
    .in("status", ["approved", "pending"])
    .order("created_at", { ascending: false })
    .maybeSingle();

  // Has a claimed runner — show full runner profile
  if (claim) {
    const { runner_id, status: claimStatus } = claim as { runner_id: number; status: string };
    const data = await getRunner(runner_id);
    if (data) {
      const { runner, results } = data;

      const history = [...results].sort((a, b) => {
        const yearA = (a.events as any)?.year ?? 0;
        const yearB = (b.events as any)?.year ?? 0;
        return (yearB - yearA) || ((a.events as any)?.name?.localeCompare((b.events as any)?.name) ?? 0);
      });

      return (
        <div className="space-y-8">
          <div className="flex items-start gap-4 sm:gap-6">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={runner.full_name}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center text-xl sm:text-2xl font-bold text-muted-foreground shrink-0">
                {runner.full_name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{runner.full_name}</h1>
              <div className="flex gap-2 mt-1 flex-wrap">
                {runner.country && <Badge variant="secondary">{runner.country}</Badge>}
                {runner.city && <Badge variant="outline">{runner.city}</Badge>}
                {claimStatus === "approved"
                  ? <Badge variant="secondary" className="text-xs">Claimed ✓</Badge>
                  : <Badge variant="outline" className="text-xs text-muted-foreground">Pending review</Badge>
                }
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-[#22c55e]">{results.length}</p>
                <p className="text-sm text-muted-foreground">Races completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-[#22c55e]">
                  {new Set(results.map((r) => (r.events as any)?.year)).size}
                </p>
                <p className="text-sm text-muted-foreground">Active seasons</p>
              </CardContent>
            </Card>
            {runner.elo_score && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold text-[#22c55e]">{runner.elo_score}</p>
                  <p className="text-sm text-muted-foreground">ELO — Level {runner.elo_level}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">Race history</h2>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead className="hidden sm:table-cell">Year</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Place</TableHead>
                    <TableHead>Chip time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r, i) => {
                    const event = r.events as any;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <Link href={`/events/${event?.slug}`} className="hover:underline">
                            {event?.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{event?.year}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{r.distance_category}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.place ? `#${r.place}` : "—"}</TableCell>
                        <TableCell className="font-mono tabular-nums">{r.chip_time ?? r.finish_time ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      );
    }
  }

  // No claimed runner — show basic account info
  const name = user.user_metadata?.full_name as string | undefined;
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4 sm:gap-6">
        {avatar ? (
          <img
            src={avatar}
            alt={name ?? "Profile"}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center text-xl sm:text-2xl font-bold text-muted-foreground shrink-0">
            {name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">{name ?? "Runner"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 pb-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t claimed a runner profile yet. Find your name in our database and claim your race history.
          </p>
          <Link href="/runners" className="text-sm font-medium underline hover:text-foreground w-fit">
            Find your profile →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
