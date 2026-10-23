import type { Locale } from "./config";
import type common from "../messages/ru/common.json";
import type home from "../messages/ru/home.json";
import type events from "../messages/ru/events.json";
import type rankings from "../messages/ru/rankings.json";
import type runners from "../messages/ru/runners.json";
import type profile from "../messages/ru/profile.json";
import type coins from "../messages/ru/coins.json";
import type analyzer from "../messages/ru/analyzer.json";
import type legal from "../messages/ru/legal.json";

// Russian is the source of truth: t("…") keys are type-checked against it.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: {
      common: typeof common;
      home: typeof home;
      events: typeof events;
      rankings: typeof rankings;
      runners: typeof runners;
      profile: typeof profile;
      coins: typeof coins;
      analyzer: typeof analyzer;
      legal: typeof legal;
    };
  }
}
