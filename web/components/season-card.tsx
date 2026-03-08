type Season = "winter" | "spring" | "summer" | "autumn";

function getSeason(dateStr: string | null): Season {
  if (!dateStr) return "autumn";
  const month = new Date(dateStr).getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

const SEASON_STYLES: Record<Season, {
  bg: string;
  border: string;
  accent: string;
  icon: string;
}> = {
  winter: {
    bg: "linear-gradient(135deg, rgba(219,234,254,0.5) 0%, rgba(191,219,254,0.3) 100%)",
    border: "rgba(59,130,246,0.25)",
    accent: "#3B82F6",
    icon: "❄️",
  },
  spring: {
    bg: "linear-gradient(135deg, rgba(220,252,231,0.5) 0%, rgba(187,247,208,0.3) 100%)",
    border: "rgba(34,197,94,0.25)",
    accent: "#22C55E",
    icon: "🌸",
  },
  summer: {
    bg: "linear-gradient(135deg, rgba(254,249,195,0.5) 0%, rgba(254,240,138,0.3) 100%)",
    border: "rgba(234,179,8,0.25)",
    accent: "#EAB308",
    icon: "☀️",
  },
  autumn: {
    bg: "linear-gradient(135deg, rgba(255,237,213,0.5) 0%, rgba(254,215,170,0.3) 100%)",
    border: "rgba(249,115,22,0.25)",
    accent: "#F97316",
    icon: "🍂",
  },
};

// SVG pattern for each season — rendered as a background
function seasonPattern(season: Season, accent: string): string {
  const encoded = (svg: string) =>
    `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  switch (season) {
    case "winter":
      // Snowflakes
      return encoded(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <text x="10" y="25" font-size="14" opacity="0.12">❄</text>
        <text x="50" y="55" font-size="10" opacity="0.08">❄</text>
        <text x="30" y="70" font-size="8" opacity="0.1">❄</text>
        <text x="65" y="18" font-size="6" opacity="0.09">❄</text>
      </svg>`);
    case "spring":
      // Blossoms
      return encoded(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <text x="8" y="22" font-size="12" opacity="0.12">🌸</text>
        <text x="48" y="50" font-size="9" opacity="0.08">🌿</text>
        <text x="25" y="68" font-size="10" opacity="0.1">🌱</text>
        <text x="62" y="15" font-size="7" opacity="0.09">🌸</text>
      </svg>`);
    case "summer":
      // Sun rays
      return encoded(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <text x="10" y="24" font-size="13" opacity="0.1">☀</text>
        <text x="50" y="52" font-size="9" opacity="0.07">🌤</text>
        <text x="28" y="70" font-size="8" opacity="0.09">☀</text>
        <text x="64" y="16" font-size="7" opacity="0.08">✨</text>
      </svg>`);
    case "autumn":
      // Leaves
      return encoded(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
        <text x="8" y="22" font-size="13" opacity="0.12">🍂</text>
        <text x="50" y="48" font-size="9" opacity="0.08">🍁</text>
        <text x="26" y="68" font-size="10" opacity="0.1">🍃</text>
        <text x="62" y="14" font-size="7" opacity="0.09">🍂</text>
      </svg>`);
  }
}

export function SeasonCard({
  dateOfEvent,
  children,
}: {
  dateOfEvent: string | null;
  children: React.ReactNode;
}) {
  const season = getSeason(dateOfEvent);
  const style = SEASON_STYLES[season];
  const pattern = seasonPattern(season, style.accent);

  return (
    <div
      className="rounded-lg border p-4 h-full transition-colors hover:border-primary cursor-pointer relative overflow-hidden"
      style={{
        background: style.bg,
        borderColor: style.border,
      }}
    >
      {/* Pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: pattern,
          backgroundRepeat: "repeat",
          backgroundSize: "80px 80px",
        }}
      />
      {/* Season icon */}
      <span className="absolute top-2 right-3 text-lg opacity-40 select-none">
        {style.icon}
      </span>
      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
