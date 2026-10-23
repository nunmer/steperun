"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/utils";
import type { CoinPack } from "@/lib/coins-config";

interface PaddleCheckoutOpenOptions {
  items: { priceId: string; quantity: number }[];
  customData: { user_id: string };
  customer?: { email: string };
  settings?: { displayMode?: string; successUrl?: string };
}

interface PaddleGlobal {
  Environment?: { set: (env: "sandbox" | "production") => void };
  Initialize: (opts: { token: string; eventCallback?: (event: { name: string }) => void }) => void;
  Checkout: { open: (opts: PaddleCheckoutOpenOptions) => void };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

interface Props {
  userId: string;
  userEmail: string;
  packs: CoinPack[];
  clientToken: string | null;
  environment: "sandbox" | "production";
}

/** Badge texts from coins-config, as message keys. */
const BADGE_KEYS: Record<string, "save10" | "bestValue"> = { "Save 10%": "save10", "Best value": "bestValue" };

export function CoinPacks({ userId, userEmail, packs, clientToken, environment }: Props) {
  const t = useTranslations("coins.packs");
  const locale = useLocale();
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!clientToken) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.Paddle) return;
      try {
        window.Paddle.Environment?.set(environment);
        window.Paddle.Initialize({ token: clientToken });
        setReady(true);
      } catch (e) {
        console.error("[paddle] init failed", e);
        setReady(false);
      }
    };

    if (window.Paddle) {
      // Script already loaded (client-side navigation back to this page).
      queueMicrotask(init);
    } else {
      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      script.onload = init;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientToken, environment]);

  function buy(pack: CoinPack) {
    if (!ready || !window.Paddle || !pack.paddlePriceId) return;
    setOpening(pack.id);
    window.Paddle.Checkout.open({
      items: [{ priceId: pack.paddlePriceId, quantity: 1 }],
      customData: { user_id: userId },
      customer: { email: userEmail },
      settings: {
        displayMode: "overlay",
        successUrl: `${window.location.origin}/coins?purchase=success`,
      },
    });
    setTimeout(() => setOpening(null), 1500);
  }

  if (!clientToken) {
    return (
      <div className="border-b py-6 text-sm text-muted-foreground">
        {t("notConfigured")}
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-3 border-b sm:divide-x divide-y sm:divide-y-0">
      {packs.map((p) => {
        const disabled = !ready || !p.paddlePriceId || opening === p.id;
        const perCoin = (p.priceKzt / p.coins).toFixed(0);
        return (
          <div
            key={p.id}
            className="relative py-5 sm:px-5 sm:first:pl-0 flex flex-col gap-3"
          >
            {p.badge && (
              <span className="eyebrow !text-primary">
                {BADGE_KEYS[p.badge] ? t(`badges.${BADGE_KEYS[p.badge]}`) : p.badge}
              </span>
            )}
            <div>
              <div className="headline text-5xl tabular-nums">{p.coins}<span className="text-2xl text-muted-foreground"> {t("coinsUnit", { count: p.coins })}</span></div>
              <div className="text-sm text-muted-foreground mt-1">
                {formatNumber(p.priceKzt, locale)} ₸
                <span className="text-xs opacity-60"> · {t("perCoin", { price: perCoin })}</span>
              </div>
            </div>
            <button
              onClick={() => buy(p)}
              disabled={disabled}
              className="mt-auto h-10 px-4 rounded-sm text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!p.paddlePriceId ? t("comingSoon") : opening === p.id ? t("opening") : t("buy")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
