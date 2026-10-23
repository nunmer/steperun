import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalHeader, legalTags, legalValues } from "../legal-text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("title"), description: t("description", legalValues) };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");
  const r = (key: Parameters<typeof t.rich>[0]) => t.rich(key, { ...legalValues, ...legalTags });

  return (
    <>
      <LegalHeader title={t("title")} />

      <p>{r("intro")}</p>

      <h2>{t("s1.h")}</h2>
      <p>{r("s1.p")}</p>

      <h2>{t("s2.h")}</h2>
      <ul>
        <li>{r("s2.li1")}</li>
        <li>{r("s2.li2")}</li>
        <li>{r("s2.li3")}</li>
        <li>{r("s2.li4")}</li>
        <li>{r("s2.li5")}</li>
        <li>{r("s2.li6")}</li>
      </ul>

      <h2>{t("s3.h")}</h2>
      <p>{r("s3.p")}</p>

      <h2>{t("s4.h")}</h2>
      <ul>
        <li>{r("s4.li1")}</li>
        <li>{r("s4.li2")}</li>
        <li>{r("s4.li3")}</li>
        <li>{r("s4.li4")}</li>
        <li>{r("s4.li5")}</li>
        <li>{r("s4.li6")}</li>
      </ul>

      <h2>{t("s5.h")}</h2>
      <p>{r("s5.p")}</p>

      <h2>{t("s6.h")}</h2>
      <p>{r("s6.p1")}</p>
      <ul>
        <li>{r("s6.li1")}</li>
        <li>{r("s6.li2")}</li>
        <li>{r("s6.li3")}</li>
      </ul>
      <p>{r("s6.p2")}</p>

      <h2>{t("s7.h")}</h2>
      <p>{r("s7.p")}</p>

      <h2>{t("s8.h")}</h2>
      <p>{r("s8.p1")}</p>
      <ul>
        <li>{r("s8.li1")}</li>
        <li>{r("s8.li2")}</li>
        <li>{r("s8.li3")}</li>
        <li>{r("s8.li4")}</li>
        <li>{r("s8.li5")}</li>
      </ul>
      <p>{r("s8.p2")}</p>

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
    </>
  );
}
