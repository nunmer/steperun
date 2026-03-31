/**
 * Coin balance — wallet-style currency display.
 * Compact pill with coin icon and balance, like in-game currency.
 */

interface CoinBalanceProps {
  amount: number;
  size?: "sm" | "md";
}

export function CoinBalance({ amount, size = "md" }: CoinBalanceProps) {
  const isSm = size === "sm";

  return (
    <div className={`
      inline-flex items-center gap-1.5 rounded-full
      bg-amber-500/10 border border-amber-500/20
      ${isSm ? "px-2.5 py-0.5" : "px-3 py-1"}
    `}>
      {/* Coin icon */}
      <svg
        viewBox="0 0 20 20"
        className={`${isSm ? "w-3.5 h-3.5" : "w-4 h-4"} shrink-0`}
        fill="none"
      >
        <circle cx="10" cy="10" r="9" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
        <circle cx="10" cy="10" r="6.5" fill="none" stroke="#d97706" strokeWidth="0.8" opacity="0.5" />
        <text
          x="10" y="10.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#92400e"
          fontSize="8"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          S
        </text>
      </svg>
      <span className={`
        font-bold font-mono tabular-nums text-amber-500
        ${isSm ? "text-xs" : "text-sm"}
      `}>
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
