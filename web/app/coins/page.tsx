export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/format";
import { formatNumber } from "@/lib/utils";
import { getAuthUser } from "@/lib/supabase-server";
import { COIN_REWARDS, getBalance, getCoinHistory } from "@/lib/services/coins";
import { PageHeader } from "@/components/sheet";
import { CoinPacks } from "@/components/coin-packs";
import { COIN_PACKS, COIN_ECONOMY, getPaddleClientConfig } from "@/lib/coins-config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coins.page");
  return { title: t("title"), description: t("description") };
}

const REASONS = [
  "claim_approved", "strava_connected", "event_participation", "purchase",
  "analysis_spent", "analysis_refund", "admin_adjustment",
] as const;
type Reason = (typeof REASONS)[number];
const isReason = (r: string): r is Reason => (REASONS as readonly string[]).includes(r);

const EARN_WAYS = [
  { key: "strava", coins: COIN_REWARDS.STRAVA_CONNECTED, perEvent: false },
  { key: "claim", coins: COIN_REWARDS.CLAIM_APPROVED, perEvent: false },
  { key: "race", coins: COIN_REWARDS.EVENT_PARTICIPATION, perEvent: true },
] as const;

export default async function CoinsPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/");

  const { purchase } = await searchParams;
  const [t, locale] = await Promise.all([getTranslations("coins.page"), getLocale()]);

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
          title={t("title")}
          aside={
            <span className="max-w-xs inline-block">
              {t("costNote", { cost: COIN_ECONOMY.ANALYSIS_COST, free: COIN_ECONOMY.FREE_ANALYSES })}
            </span>
          }
        />
        <p className="eyebrow">{t("balance")}</p>
        <p className="headline text-7xl tabular-nums mt-1">{formatNumber(balance, locale)}</p>
      </div>

      {purchase === "success" && (
        <div className="border-l-4 border-positive bg-card p-4 text-sm">
          {t("paymentReceived")}
        </div>
      )}

      {!paymentsEnabled && (
        <section className="space-y-4">
          <h2 className="headline text-3xl border-b-2 border-rule pb-2">{t("earnTitle")}</h2>
          <ul className="divide-y border-b text-sm">
            {EARN_WAYS.map((w) => (
              <li key={w.key} className="flex items-center justify-between gap-4 py-3">
                <span>{t(`earn.${w.key}`)}</span>
                <span className="time font-semibold text-positive shrink-0">
                  +{w.coins}{w.perEvent ? t("perRace") : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {t.rich("earnHint", {
              profile: (chunks) => <Link href="/profile" className="underline hover:text-foreground">{chunks}</Link>,
            })}
          </p>
        </section>
      )}

      {paymentsEnabled && (
      <section className="space-y-4">
        <h2 className="headline text-3xl border-b-2 border-rule pb-2">{t("buyTitle")}</h2>
        <CoinPacks
          userId={user.id}
          userEmail={user.email ?? ""}
          packs={packs}
          clientToken={paddle.clientToken}
          environment={paddle.environment}
        />
        <p className="text-xs text-muted-foreground">
          {t.rich("paddleNote", {
            refund: (chunks) => <Link href="/legal/refund" className="underline hover:text-foreground">{chunks}</Link>,
          })}
        </p>
      </section>
      )}

      <section className="space-y-4">
        <h2 className="headline text-3xl border-b-2 border-rule pb-2">{t("historyTitle")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 eyebrow font-normal">{t("table.date")}</th>
                  <th className="text-left py-2 pr-4 eyebrow font-normal">{t("table.reason")}</th>
                  <th className="text-right py-2 eyebrow font-normal">{t("table.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2.5 pr-4 time text-xs text-muted-foreground">
                      {formatDate(h.created_at, locale, { day: true, month: "short", year: "numeric", time: true, timeZone: "Asia/Almaty" })}
                    </td>
                    <td className="py-2.5 pr-4">{isReason(h.reason) ? t(`reasons.${h.reason}`) : h.reason}</td>
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
