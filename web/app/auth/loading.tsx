import { getTranslations } from "next-intl/server";

export default async function AuthLoading() {
  const t = await getTranslations("profile.page");
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground text-sm">
      {t("loading")}
    </div>
  );
}
