import { getTranslations } from "next-intl/server";
import { SheetSkeleton } from "@/components/sheet-skeleton";

export default async function RankingsLoading() {
  const t = await getTranslations("rankings.list");
  return <SheetSkeleton title={t("title")} filters={2} />;
}
