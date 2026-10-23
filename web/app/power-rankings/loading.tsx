import { getTranslations } from "next-intl/server";
import { SheetSkeleton } from "@/components/sheet-skeleton";

export default async function PowerRankingsLoading() {
  const t = await getTranslations("rankings.power");
  return <SheetSkeleton title={t("title")} />;
}
