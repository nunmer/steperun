/**
 * ELO card + stat cards with matching fading outline style.
 * Uses real flag images from flagcdn.com and city coat-of-arms style icons.
 */

const LEVEL_COLORS: Record<number, { ring: string; glow: string }> = {
  1:  { ring: "#6b7280", glow: "#6b728040" },
  2:  { ring: "#a3a3a3", glow: "#a3a3a340" },
  3:  { ring: "#fbbf24", glow: "#fbbf2440" },
  4:  { ring: "#f59e0b", glow: "#f59e0b40" },
  5:  { ring: "#22c55e", glow: "#22c55e40" },
  6:  { ring: "#10b981", glow: "#10b98140" },
  7:  { ring: "#3b82f6", glow: "#3b82f640" },
  8:  { ring: "#8b5cf6", glow: "#8b5cf640" },
  9:  { ring: "#ec4899", glow: "#ec489940" },
  10: { ring: "#ef4444", glow: "#ef444440" },
};

function getLevelStyle(level: number) {
  return LEVEL_COLORS[level] ?? LEVEL_COLORS[1];
}

// Map country name (EN/RU) → ISO 3166-1 alpha-2 code
const COUNTRY_CODES: Record<string, string> = {
  "Kazakhstan": "kz", "Казахстан": "kz",
  "Russia": "ru", "Россия": "ru",
  "Uzbekistan": "uz", "Узбекистан": "uz",
  "Kyrgyzstan": "kg", "Кыргызстан": "kg",
  "Tajikistan": "tj", "Таджикистан": "tj",
  "Turkmenistan": "tm", "Туркменистан": "tm",
  "China": "cn", "Китай": "cn",
  "Turkey": "tr", "Турция": "tr",
  "USA": "us", "США": "us",
  "Germany": "de", "Германия": "de",
  "UK": "gb", "Великобритания": "gb",
  "France": "fr", "Франция": "fr",
  "Kenya": "ke", "Ethiopia": "et",
  "India": "in", "Индия": "in",
  "Japan": "jp", "Япония": "jp",
  "South Korea": "kr", "Корея": "kr",
  "Georgia": "ge", "Грузия": "ge",
  "Azerbaijan": "az", "Азербайджан": "az",
  "Armenia": "am", "Армения": "am",
  "Belarus": "by", "Беларусь": "by",
  "Ukraine": "ua", "Украина": "ua",
  "Mongolia": "mn", "Монголия": "mn",
  "Iran": "ir", "Иран": "ir",
};

function getCountryCode(country: string): string | null {
  return COUNTRY_CODES[country] ?? null;
}

// Country flag image from flagcdn.com CDN
function CountryFlag({ country }: { country: string }) {
  const code = getCountryCode(country);
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/20x15/${code}.png`}
      srcSet={`https://flagcdn.com/40x30/${code}.png 2x`}
      width={20}
      height={15}
      alt={country}
      className="rounded-[2px] shrink-0"
    />
  );
}

// City coat-of-arms style mini badge
// Major KZ cities get their heraldic colors; others get a neutral city icon
const CITY_COLORS: Record<string, { bg: string; accent: string }> = {
  "Астана":  { bg: "#0072CE", accent: "#FFD700" },  // blue + gold
  "Astana":  { bg: "#0072CE", accent: "#FFD700" },
  "Алматы":  { bg: "#006847", accent: "#FFFFFF" },  // green + white (apple city)
  "Almaty":  { bg: "#006847", accent: "#FFFFFF" },
  "Шымкент": { bg: "#DC143C", accent: "#FFD700" },  // red + gold
  "Shymkent": { bg: "#DC143C", accent: "#FFD700" },
  "Караганда": { bg: "#1C1C1C", accent: "#F59E0B" }, // dark + amber (mining)
  "Karaganda": { bg: "#1C1C1C", accent: "#F59E0B" },
  "Актау":   { bg: "#0EA5E9", accent: "#FFFFFF" },   // sky blue (Caspian)
  "Aktau":   { bg: "#0EA5E9", accent: "#FFFFFF" },
  "Атырау":  { bg: "#0369A1", accent: "#F59E0B" },   // blue + gold (oil)
  "Atyrau":  { bg: "#0369A1", accent: "#F59E0B" },
  "Павлодар": { bg: "#2563EB", accent: "#FFFFFF" },
  "Pavlodar": { bg: "#2563EB", accent: "#FFFFFF" },
  "Актобе":  { bg: "#7C3AED", accent: "#FFFFFF" },
  "Aktobe":  { bg: "#7C3AED", accent: "#FFFFFF" },
};

function CityBadge({ city }: { city: string }) {
  const colors = CITY_COLORS[city];
  if (colors) {
    return (
      <svg viewBox="0 0 20 15" width={20} height={15} className="rounded-[2px] shrink-0">
        <rect width="20" height="15" rx="1.5" fill={colors.bg} />
        {/* Shield/crest shape */}
        <path d="M10 3 L14 5 L14 9 Q14 12 10 13 Q6 12 6 9 L6 5 Z" fill={colors.accent} opacity="0.9" />
      </svg>
    );
  }
  // Fallback: neutral city icon
  return (
    <svg viewBox="0 0 20 15" width={20} height={15} className="rounded-[2px] shrink-0">
      <rect width="20" height="15" rx="1.5" fill="#374151" />
      <rect x="4" y="5" width="3" height="7" fill="#9CA3AF" rx="0.5" />
      <rect x="8.5" y="3" width="3" height="9" fill="#9CA3AF" rx="0.5" />
      <rect x="13" y="6" width="3" height="6" fill="#9CA3AF" rx="0.5" />
    </svg>
  );
}

// ─── Fading outline wrapper ─────────────────────────────────────────

interface GlowCardProps {
  color: string;
  glow: string;
  children: React.ReactNode;
}

function GlowCard({ color, glow, children }: GlowCardProps) {
  return (
    <div
      className="relative rounded-xl overflow-hidden bg-card text-card-foreground"
      style={{ boxShadow: `0 0 20px ${glow}, inset 0 0 20px ${glow}` }}
    >
      <div className="absolute inset-0 rounded-xl pointer-events-none" style={{
        border: `1px solid ${color}40`,
        mask: "linear-gradient(to bottom, black 60%, transparent 100%)",
        WebkitMask: "linear-gradient(to bottom, black 60%, transparent 100%)",
      }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: `linear-gradient(90deg, transparent 10%, ${color}80 50%, transparent 90%)`,
      }} />
      {children}
    </div>
  );
}

// ─── EloCard ────────────────────────────────────────────────────────

interface EloCardProps {
  score: number;
  level: number;
  cityRank?: number | null;
  countryRank?: number | null;
  city?: string | null;
  country?: string | null;
}

export function EloCard({ score, level, cityRank, countryRank, city, country }: EloCardProps) {
  const style = getLevelStyle(level);
  const circumference = 2 * Math.PI * 38;
  const progress = Math.min(100, (level / 10) * 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <GlowCard color={style.ring} glow={style.glow}>
      {/* Badge + score */}
      <div className="flex flex-col items-center pt-3 pb-2 px-3">
        <div className="w-14 h-14 sm:w-16 sm:h-16">
          <svg viewBox="0 0 90 90" className="w-full h-full" style={{ filter: `drop-shadow(0 0 8px ${style.glow})` }}>
            <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="45" cy="45" r="38" fill="none"
              stroke={style.ring} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 45 45)"
            />
            <circle cx="45" cy="45" r="30" fill="rgba(0,0,0,0.5)" stroke={style.ring} strokeWidth="0.8" opacity="0.3" />
            <text
              x="45" y="45" textAnchor="middle" dominantBaseline="central"
              fill={style.ring} fontSize="22" fontWeight="bold" fontFamily="system-ui, sans-serif"
            >
              {level}
            </text>
          </svg>
        </div>
        <p className="text-lg font-bold font-mono tabular-nums mt-1" style={{ color: style.ring }}>
          {score.toLocaleString()}
        </p>
      </div>

      {/* Divider line */}
      <div className="mx-3 h-px" style={{
        background: `linear-gradient(90deg, transparent, ${style.ring}30, transparent)`,
      }} />

      {/* Regional ranks with real flags */}
      <div className="flex items-center justify-center gap-3 px-3 py-2 min-h-[32px]">
        {cityRank && city && (
          <div className="flex items-center gap-1.5">
            <CityBadge city={city} />
            <span className="text-[11px] font-mono font-bold" style={{ color: style.ring }}>#{cityRank}</span>
          </div>
        )}
        {countryRank && country && (
          <div className="flex items-center gap-1.5">
            <CountryFlag country={country} />
            <span className="text-[11px] font-mono font-bold" style={{ color: style.ring }}>#{countryRank}</span>
          </div>
        )}
        {!cityRank && !countryRank && (
          <span className="text-[11px] text-muted-foreground">ELO</span>
        )}
      </div>
    </GlowCard>
  );
}

// ─── StatCard (matching fading outline) ─────────────────────────────

interface StatCardProps {
  value: number | string;
  label: string;
  color?: string;
}

export function StatCard({ value, label, color = "#22c55e" }: StatCardProps) {
  const glow = color + "40";
  return (
    <GlowCard color={color} glow={glow}>
      <div className="pt-4 pb-4 px-4">
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </GlowCard>
  );
}
