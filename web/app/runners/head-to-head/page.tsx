import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BackLink, PageHeader } from "@/components/sheet";
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

type H2hT = Awaited<ReturnType<typeof getTranslations<"runners.h2h">>>;

function buildTease(
  t: H2hT,
  aName: string,
  bName: string,
  winsA: number,
  winsB: number,
): string {
  const vars = { a: aName.split(" ")[0], b: bName.split(" ")[0], wa: String(winsA), wb: String(winsB) };
  if (winsA + winsB === 0) return t("teaseNone", vars);
  if (winsA > winsB) return t("teaseAWins", vars);
  if (winsB > winsA) return t("teaseBWins", vars);
  return t("teaseEven", vars);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { a, b } = await searchParams;
  const t = await getTranslations("runners.h2h");
  const aId = a ? Number(a) : null;
  const bId = b ? Number(b) : null;

  if (!aId || !bId || Number.isNaN(aId) || Number.isNaN(bId)) {
    return {
      title: t("title"),
      description: t("metaDescription"),
    };
  }

  const [aData, bData] = await Promise.all([getRunner(aId), getRunner(bId)]);
  if (!aData || !bData) {
    return { title: t("title") };
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

  const tease = buildTease(t, aData.runner.full_name, bData.runner.full_name, winsA, winsB);
  const title = `${aData.runner.full_name} vs ${bData.runner.full_name}`;

  return {
    title,
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

export default async function HeadToHeadPage() {
  const t = await getTranslations("runners.h2h");
  return (
    <div>
      <PageHeader
        kicker={<BackLink href="/runners">{t("back")}</BackLink>}
        title={t("title")}
        aside={t("aside")}
      />

      <Suspense fallback={null}>
        <HeadToHead />
      </Suspense>
    </div>
  );
}
