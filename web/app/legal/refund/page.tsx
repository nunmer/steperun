import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalHeader, legalTags, legalValues } from "../legal-text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.refund");
  return { title: t("title"), description: t("description", legalValues) };
}

export default async function RefundPage() {
  const t = await getTranslations("legal.refund");
  const r = (key: Parameters<typeof t.rich>[0]) => t.rich(key, { ...legalValues, ...legalTags });

  return (
    <>
      <LegalHeader title={t("title")} />

      <p>{r("intro")}</p>

      <h2>{t("s1.h")}</h2>
      <p>{r("s1.p")}</p>

      <h2>{t("s2.h")}</h2>
      <p>{r("s2.p")}</p>
      <ul>
        <li>{r("s2.li1")}</li>
        <li>{r("s2.li2")}</li>
        <li>{r("s2.li3")}</li>
        <li>{r("s2.li4")}</li>
      </ul>

      <h2>{t("s3.h")}</h2>
      <p>{r("s3.p")}</p>
      <ul>
        <li>{r("s3.li1")}</li>
        <li>{r("s3.li2")}</li>
        <li>{r("s3.li3")}</li>
        <li>{r("s3.li4")}</li>
        <li>{r("s3.li5")}</li>
      </ul>

      <h2>{t("s4.h")}</h2>
      <p>{r("s4.p")}</p>
      <ul>
        <li>{r("s4.li1")}</li>
        <li>{r("s4.li2")}</li>
        <li>{r("s4.li3")}</li>
      </ul>

      <h2>{t("s5.h")}</h2>
      <p>{r("s5.p")}</p>

      <h2>{t("s6.h")}</h2>
      <p>{r("s6.p")}</p>

      <h2>{t("s7.h")}</h2>
      <p>{r("s7.p")}</p>

      <h2>{t("s8.h")}</h2>
      <p>{r("s8.p")}</p>
    </>
  );
}
