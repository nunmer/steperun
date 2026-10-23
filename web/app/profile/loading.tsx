import { getTranslations } from "next-intl/server";
import { SheetSkeleton } from "@/components/sheet-skeleton";

export default async function ProfileLoading() {
  const t = await getTranslations("profile.page");
  return <SheetSkeleton title={t("kicker")} filters={0} rows={8} />;
}
