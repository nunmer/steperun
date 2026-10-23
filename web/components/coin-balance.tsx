import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn, formatNumber } from "@/lib/utils";

interface CoinBalanceProps {
  amount: number;
  size?: "sm" | "md";
  asLink?: boolean;
}

/** Balance as a mono figure with a small ochre coin mark. */
export function CoinBalance({ amount, size = "md", asLink = true }: CoinBalanceProps) {
  const t = useTranslations("coins.packs");
  const locale = useLocale();
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 time",
        size === "sm" ? "text-xs" : "text-sm",
        asLink && "hover:text-primary transition-colors",
      )}
    >
      <span aria-hidden className={cn("rounded-full bg-caution", size === "sm" ? "size-2" : "size-2.5")} />
      <span className="font-semibold">{formatNumber(amount, locale)}</span>
      <span className="text-muted-foreground">{t("coinsUnit", { count: amount })}</span>
    </span>
  );

  if (asLink) {
    return <Link href="/coins" aria-label={t("balanceLabel", { count: amount })}>{content}</Link>;
  }
  return content;
}
