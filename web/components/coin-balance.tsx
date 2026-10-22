import Link from "next/link";
import { cn } from "@/lib/utils";

interface CoinBalanceProps {
  amount: number;
  size?: "sm" | "md";
  asLink?: boolean;
}

/** Balance as a mono figure with a small ochre coin mark. */
export function CoinBalance({ amount, size = "md", asLink = true }: CoinBalanceProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 time",
        size === "sm" ? "text-xs" : "text-sm",
        asLink && "hover:text-primary transition-colors",
      )}
    >
      <span aria-hidden className={cn("rounded-full bg-caution", size === "sm" ? "size-2" : "size-2.5")} />
      <span className="font-semibold">{amount.toLocaleString()}</span>
      <span className="text-muted-foreground">coins</span>
    </span>
  );

  if (asLink) {
    return <Link href="/coins" aria-label={`${amount} coins`}>{content}</Link>;
  }
  return content;
}
