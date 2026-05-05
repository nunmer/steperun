import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { HeadToHead } from "@/components/head-to-head";
import { getRunner } from "@/lib/queries";

type SearchParams = Promise<{ a?: string; b?: string }>;

function toSeconds(t: string): number {
  const clean = t.split(".")[0];
  const parts = clean.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
}

function buildTease(
  aName: string,
  bName: string,
  winsA: number,
  winsB: number,
): string {
  const a = aName.split(" ")[0];
  const b = bName.split(" ")[0];
  if (winsA + winsB === 0) return `${a} vs ${b} — who's the real runner?`;
  if (winsA > winsB)
    return `${a} just smoked ${b} ${winsA}–${winsB} head-to-head. Think you can do better?`;
  if (winsB > winsA)
    return `${b} crushed ${a} ${winsB}–${winsA}. Don't believe it? See for yourself.`;
  return `${a} and ${b} are dead even at ${winsA}–${winsB}. Who breaks the tie?`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { a, b } = await searchParams;
  const aId = a ? Number(a) : null;
  const bId = b ? Number(b) : null;

  if (!aId || !bId || Number.isNaN(aId) || Number.isNaN(bId)) {
    return {
      title: "Head to Head — steperun",
      description: "Compare two runners side by side.",
    };
  }

  const [aData, bData] = await Promise.all([getRunner(aId), getRunner(bId)]);
  if (!aData || !bData) {
    return { title: "Head to Head — steperun" };
  }

  const bMap = new Map<string, string | null>();
  for (const r of bData.results) {
    bMap.set(`${r.events?.slug}:${r.distance_category}`, r.chip_time);
  }
  let winsA = 0;
  let winsB = 0;
  for (const rA of aData.results) {
    const tB = bMap.get(`${rA.events?.slug}:${rA.distance_category}`);
    if (tB === undefined) continue;
    const tA = rA.chip_time && rA.chip_time !== "--:--:--" ? toSeconds(rA.chip_time) : Infinity;
    const sB = tB && tB !== "--:--:--" ? toSeconds(tB) : Infinity;
    if (tA === Infinity && sB === Infinity) continue;
    if (tA < sB) winsA++;
    else if (sB < tA) winsB++;
  }

  const tease = buildTease(aData.runner.full_name, bData.runner.full_name, winsA, winsB);
  const title = `${aData.runner.full_name} vs ${bData.runner.full_name}`;

  return {
    title: `${title} — steperun`,
    description: tease,
    openGraph: {
      title,
      description: tease,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tease,
    },
  };
}

export default function HeadToHeadPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/runners"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← All runners
        </Link>
        <h1 className="text-3xl font-bold">Head to Head</h1>
        <p className="text-muted-foreground mt-1">
          Compare two runners side by side
        </p>
      </div>

      <Suspense fallback={null}>
        <HeadToHead />
      </Suspense>
    </div>
  );
}
