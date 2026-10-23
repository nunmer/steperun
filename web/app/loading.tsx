import { getTranslations } from "next-intl/server";

export default async function HomeLoading() {
  const t = await getTranslations("home.hero");
  return (
    <div
      aria-busy="true"
      className="dark relative w-screen ml-[calc(50%-50vw)] -mt-[5.5rem] sm:-mt-[6.5rem] min-h-[100svh] bg-background text-foreground bg-cover bg-center"
      style={{ backgroundImage: "url(/media/hero-poster.jpg)" }}
    >
      <div className="absolute inset-0 bg-background/70" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-32">
        <h1 className="headline text-[3.6rem] leading-[0.86] sm:text-8xl text-foreground/30">
          {t("line1")}
          <br />
          {t("line2")}
          <br />
          {t("line3")}
        </h1>
      </div>
    </div>
  );
}
