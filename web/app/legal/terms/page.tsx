import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalHeader, legalTags, legalValues } from "../legal-text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("title"), description: t("description", legalValues) };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");
  const r = (key: Parameters<typeof t.rich>[0]) => t.rich(key, { ...legalValues, ...legalTags });

  return (
    <>
      <LegalHeader title={t("title")} />

      <h2>{t("s1.h")}</h2>
      <p>{r("s1.p")}</p>

      <h2>{t("s2.h")}</h2>
      <p>{r("s2.p")}</p>

      <h2>{t("s3.h")}</h2>
      <p>{r("s3.p")}</p>

      <h2>{t("s4.h")}</h2>
      <p>{r("s4.p")}</p>

      <h2>{t("s5.h")}</h2>
      <p>{r("s5.p1")}</p>
      <ul>
        <li>{r("s5.li1")}</li>
        <li>{r("s5.li2")}</li>
      </ul>
      <p>{r("s5.p2")}</p>
      <p>{r("s5.p3")}</p>

      <h2>{t("s6.h")}</h2>
      <p>{r("s6.p")}</p>
      <ul>
        <li>{r("s6.li1")}</li>
        <li>{r("s6.li2")}</li>
        <li>{r("s6.li3")}</li>
        <li>{r("s6.li4")}</li>
        <li>{r("s6.li5")}</li>
      </ul>

      <h2>{t("s7.h")}</h2>
      <p>{r("s7.p")}</p>

      <h2>{t("s8.h")}</h2>
      <p>{r("s8.p")}</p>

      <h2>{t("s9.h")}</h2>
      <p>{r("s9.p")}</p>

      <h2>{t("s10.h")}</h2>
      <p>{r("s10.p")}</p>

      <h2>{t("s11.h")}</h2>
      <p>{r("s11.p")}</p>

      <h2>{t("s12.h")}</h2>
      <p>{r("s12.p")}</p>

      <h2>{t("s13.h")}</h2>
      <p>{r("s13.p")}</p>

      <h2>{t("s14.h")}</h2>
      <p>{r("s14.p")}</p>
    </>
  );
}
