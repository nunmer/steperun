export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { getRunner, getEloRanks } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getBalance } from "@/lib/services/coins";
import { EloCard, StatCard } from "@/components/elo-badge";
import { CoinBalance } from "@/components/coin-balance";

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

  const coins = await getBalance(user.id);

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

      const eloRanks = runner.elo_score
        ? await getEloRanks(runner.id, runner.city, runner.country, runner.elo_score)
        : { cityRank: null, countryRank: null };

      return (
        <div className="space-y-8">
          {/* Header: avatar, name, badges, coins */}
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
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{runner.full_name}</h1>
                <CoinBalance amount={coins} />
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {runner.country && <Badge variant="secondary">{runner.country}</Badge>}
                {runner.city && <Badge variant="outline">{runner.city}</Badge>}
                {claimStatus === "approved"
                  ? <Badge variant="secondary" className="text-xs">Claimed</Badge>
                  : <Badge variant="outline" className="text-xs text-muted-foreground">Pending review</Badge>
                }
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {runner.elo_score && runner.elo_level && (
              <EloCard
                score={runner.elo_score}
                level={runner.elo_level}
                cityRank={eloRanks.cityRank}
                countryRank={eloRanks.countryRank}
                city={runner.city}
                country={runner.country}
              />
            )}
            <StatCard value={results.length} label="Races completed" />
            <StatCard
              value={new Set(results.map((r) => (r.events as any)?.year)).size}
              label="Active seasons"
            />
            <StatCard
              value={new Set(results.map((r) => r.distance_category)).size}
              label="Distances run"
            />
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold">{name ?? "Runner"}</h1>
            {coins > 0 && <CoinBalance amount={coins} />}
          </div>
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
