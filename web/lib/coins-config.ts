/**
 * Coin economy — single source of truth.
 * Edit values here only. Pack price IDs come from env (Paddle dashboard).
 */

export const COIN_ECONOMY = {
  FREE_ANALYSES: 2,
  ANALYSIS_COST: 10,
} as const;

export interface CoinPack {
  id: "pack_10" | "pack_50" | "pack_200";
  coins: number;
  priceKzt: number;
  paddlePriceId: string | undefined;
  badge?: string;
}

export const COIN_PACKS: CoinPack[] = [
  {
    id: "pack_10",
    coins: 10,
    priceKzt: 200,
    paddlePriceId: process.env.PADDLE_PRICE_ID_PACK_10,
  },
  {
    id: "pack_50",
    coins: 50,
    priceKzt: 900,
    paddlePriceId: process.env.PADDLE_PRICE_ID_PACK_50,
    badge: "Save 10%",
  },
  {
    id: "pack_200",
    coins: 200,
    priceKzt: 3200,
    paddlePriceId: process.env.PADDLE_PRICE_ID_PACK_200,
    badge: "Best value",
  },
];

export function getPackByPaddlePriceId(priceId: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.paddlePriceId === priceId);
}

export interface PaddleClientConfig {
  clientToken: string | null;
  environment: "sandbox" | "production";
}

export function getPaddleClientConfig(): PaddleClientConfig {
  const env = process.env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";
  return {
    clientToken: process.env.PADDLE_CLIENT_TOKEN ?? null,
    environment: env,
  };
}
