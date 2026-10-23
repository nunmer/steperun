import { getTranslations } from "next-intl/server";
import { SheetSkeleton } from "@/components/sheet-skeleton";

export default async function RunnersLoading() {
  const t = await getTranslations("runners.list");
  return <SheetSkeleton title={t("title")} filters={0} />;
}
