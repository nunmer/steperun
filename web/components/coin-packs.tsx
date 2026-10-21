"use client";

import { useEffect, useState } from "react";
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

export function CoinPacks({ userId, userEmail, packs, clientToken, environment }: Props) {
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
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Payments are not configured yet. Please contact support to top up your balance.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {packs.map((p) => {
        const disabled = !ready || !p.paddlePriceId || opening === p.id;
        const perCoin = (p.priceKzt / p.coins).toFixed(0);
        return (
          <div
            key={p.id}
            className="relative rounded-lg border border-border bg-card p-5 flex flex-col gap-3"
          >
            {p.badge && (
              <span className="absolute -top-2 right-3 px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-amber-500 text-amber-950">
                {p.badge}
              </span>
            )}
            <div>
              <div className="text-2xl font-bold tabular-nums">{p.coins} coins</div>
              <div className="text-sm text-muted-foreground mt-1">
                {p.priceKzt.toLocaleString()} ₸
                <span className="text-xs opacity-60"> · {perCoin} ₸/coin</span>
              </div>
            </div>
            <button
              onClick={() => buy(p)}
              disabled={disabled}
              className="mt-auto px-4 py-2 rounded-md text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!p.paddlePriceId ? "Coming soon" : opening === p.id ? "Opening…" : "Buy"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
