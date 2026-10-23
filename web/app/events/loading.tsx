import { getTranslations } from "next-intl/server";
import { SheetSkeleton } from "@/components/sheet-skeleton";

export default async function EventsLoading() {
  const t = await getTranslations("events.list");
  return <SheetSkeleton title={t("title")} />;
}
