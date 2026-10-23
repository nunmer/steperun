import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("common.notFound");
  return { title: t("title") };
}

export default async function NotFound() {
  const t = await getTranslations("common.notFound");
  return (
    <div className="py-10 sm:py-16 max-w-2xl">
      <p className="eyebrow">404</p>
      <h1 className="headline text-6xl sm:text-8xl mt-2">
        {t("line1")} <span className="text-primary">{t("line2")}</span>
      </h1>
      <p className="mt-6 text-muted-foreground">
        {t("body")}
      </p>
      <ul className="mt-8 text-sm divide-y border-y max-w-sm">
        {[
          { href: "/runners", label: t("searchRunners") },
          { href: "/events", label: t("browseRaces") },
          { href: "/", label: t("home") },
        ].map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="flex justify-between py-2.5 hover:text-primary">
              {label} <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
