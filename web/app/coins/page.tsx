export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/supabase-server";
import { COIN_REWARDS, getBalance, getCoinHistory } from "@/lib/services/coins";
import { PageHeader } from "@/components/sheet";
import { CoinPacks } from "@/components/coin-packs";
import { COIN_PACKS, COIN_ECONOMY, getPaddleClientConfig } from "@/lib/coins-config";

export const metadata: Metadata = {
  title: "Coins",
  description: "Earn and spend coins on AI Coach analyses.",
};

const REASON_LABELS: Record<string, string> = {
  claim_approved:      "Runner profile claimed",
  strava_connected:    "Strava connected",
  event_participation: "Race participation reward",
  purchase:            "Coins purchased",
  analysis_spent:      "AI Coach analysis",
  analysis_refund:     "Analysis refund",
};

const EARN_WAYS = [
  { label: "Connect Strava", coins: COIN_REWARDS.STRAVA_CONNECTED, perEvent: false },
  { label: "Get your runner profile claim approved", coins: COIN_REWARDS.CLAIM_APPROVED, perEvent: false },
  { label: "Each race in your claimed profile", coins: COIN_REWARDS.EVENT_PARTICIPATION, perEvent: true },
];

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
  // Purchases are only offered once Paddle is configured; until then coins
  // are earn-only and the buy section is replaced by ways to earn.
  const paymentsEnabled = paddle.clientToken !== null;
  const packs = COIN_PACKS;

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <PageHeader
          title="Coins"
          aside={
            <span className="max-w-xs inline-block">
              AI Coach costs {COIN_ECONOMY.ANALYSIS_COST} coins per analysis. Your first {COIN_ECONOMY.FREE_ANALYSES} are free.
            </span>
          }
        />
        <p className="eyebrow">Balance</p>
        <p className="headline text-7xl tabular-nums mt-1">{balance.toLocaleString()}</p>
      </div>

      {purchase === "success" && (
        <div className="border-l-4 border-positive bg-card p-4 text-sm">
          Payment received. Your coins will appear within a few seconds — refresh the page if you don&apos;t see them yet.
        </div>
      )}

      {!paymentsEnabled && (
        <section className="space-y-4">
          <h2 className="headline text-3xl border-b-2 border-rule pb-2">Earn coins</h2>
          <ul className="divide-y border-b text-sm">
            {EARN_WAYS.map((w) => (
              <li key={w.label} className="flex items-center justify-between gap-4 py-3">
                <span>{w.label}</span>
                <span className="time font-semibold text-positive shrink-0">
                  +{w.coins}{w.perEvent ? " / race" : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Connect Strava and claim your runner profile from the{" "}
            <Link href="/profile" className="underline hover:text-foreground">Profile</Link> page.
          </p>
        </section>
      )}

      {paymentsEnabled && (
      <section className="space-y-4">
        <h2 className="headline text-3xl border-b-2 border-rule pb-2">Buy coins</h2>
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
      )}

      <section className="space-y-4">
        <h2 className="headline text-3xl border-b-2 border-rule pb-2">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 eyebrow font-normal">Date</th>
                  <th className="text-left py-2 pr-4 eyebrow font-normal">Reason</th>
                  <th className="text-right py-2 eyebrow font-normal">Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2.5 pr-4 time text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4">{REASON_LABELS[h.reason] ?? h.reason}</td>
                    <td className={`py-2.5 text-right time font-semibold ${
                      h.amount > 0 ? "text-positive" : "text-destructive"
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
