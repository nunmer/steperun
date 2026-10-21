import { NextResponse } from "next/server";
import crypto from "crypto";
import { creditPurchase } from "@/lib/services/coins";
import { getPackByPaddlePriceId } from "@/lib/coins-config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

interface PaddleTransactionItem {
  price?: { id?: string };
  quantity?: number;
}

interface PaddleTransactionData {
  id?: string;
  custom_data?: { user_id?: string } | null;
  items?: PaddleTransactionItem[];
}

interface PaddleEvent {
  event_type?: string;
  data?: PaddleTransactionData;
}

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(";").map((p) => {
      const idx = p.indexOf("=");
      return idx >= 0 ? [p.slice(0, idx), p.slice(idx + 1)] : [p, ""];
    }),
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const payload = `${ts}:${rawBody}`;
  const computed = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(h1, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Paddle not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const sigHeader = request.headers.get("Paddle-Signature");

  if (!verifySignature(rawBody, sigHeader, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event_type !== "transaction.completed") {
    return NextResponse.json({ received: true, ignored: event.event_type });
  }

  // From here on, return 2xx for payloads we can never process (Paddle would
  // otherwise retry them forever) and 5xx only for transient failures.
  const tx = event.data;
  const txId = tx?.id;
  const userId = tx?.custom_data?.user_id;
  const items = tx?.items ?? [];

  if (!txId || !userId || !UUID_RE.test(userId) || items.length === 0) {
    console.error("[paddle] unprocessable transaction — reconcile manually", { txId, userId });
    return NextResponse.json({ received: true, credited: false, reason: "invalid_payload" });
  }

  let coins = 0;
  for (const item of items) {
    const priceId = item.price?.id;
    const pack = priceId ? getPackByPaddlePriceId(priceId) : undefined;
    if (!pack) {
      console.error("[paddle] unknown price id — reconcile manually", { txId, priceId });
      return NextResponse.json({ received: true, credited: false, reason: "unknown_price" });
    }
    const q = item.quantity;
    const quantity = typeof q === "number" && Number.isInteger(q) && q > 0 ? q : 1;
    coins += pack.coins * quantity;
  }

  try {
    const result = await creditPurchase(userId, coins, txId);
    if (result === "no_profile") {
      console.error("[paddle] no profile for user — reconcile manually", { txId, userId });
    }
    return NextResponse.json({ received: true, credited: result === "credited", result, coins });
  } catch (e) {
    console.error("[paddle] credit failed, Paddle will retry", { txId, userId, error: e });
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
}
