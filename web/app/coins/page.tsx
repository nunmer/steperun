export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/supabase-server";
import { getBalance, getCoinHistory } from "@/lib/services/coins";
import { CoinBalance } from "@/components/coin-balance";
import { CoinPacks } from "@/components/coin-packs";
import { COIN_PACKS, COIN_ECONOMY, getPaddleClientConfig } from "@/lib/coins-config";

export const metadata: Metadata = {
  title: "Coins",
  description: "Buy coins to unlock AI Coach analyses.",
};

const REASON_LABELS: Record<string, string> = {
  claim_approved:      "Runner profile claimed",
  strava_connected:    "Strava connected",
  event_participation: "Race participation reward",
  purchase:            "Coins purchased",
  analysis_spent:      "AI Coach analysis",
  analysis_refund:     "Analysis refund",
};

export default async function CoinsPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/");

  const { purchase } = await searchParams;

  const [balance, history] = await Promise.all([
    getBalance(user.id),
    getCoinHistory(user.id, 30),
  ]);

  const paddle = getPaddleClientConfig();
  // Show all configured packs (and any unconfigured ones as "Coming soon").
  const packs = COIN_PACKS;

  return (
    <div className="space-y-10 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coins</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Spend coins on AI Coach — {COIN_ECONOMY.ANALYSIS_COST} coins per analysis.
            First {COIN_ECONOMY.FREE_ANALYSES} analyses are free.
          </p>
        </div>
        <CoinBalance amount={balance} />
      </div>

      {purchase === "success" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 p-4 text-sm">
          Payment received. Your coins will appear within a few seconds — refresh the page if you don&apos;t see them yet.
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Buy coins</h2>
        <CoinPacks
          userId={user.id}
          userEmail={user.email ?? ""}
          packs={packs}
          clientToken={paddle.clientToken}
          environment={paddle.environment}
        />
        <p className="text-xs text-muted-foreground">
          Payments are processed securely by Paddle. See our{" "}
          <Link href="/legal/refund" className="underline hover:text-foreground">Refund Policy</Link>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Transaction history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Reason</th>
                  <th className="text-right px-4 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{REASON_LABELS[h.reason] ?? h.reason}</td>
                    <td className={`px-4 py-2 text-right font-mono tabular-nums font-semibold ${
                      h.amount > 0 ? "text-emerald-500" : "text-rose-500"
                    }`}>
                      {h.amount > 0 ? "+" : ""}{h.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
