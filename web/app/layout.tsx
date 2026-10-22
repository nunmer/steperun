import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fira_Sans_Extra_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ThemeProvider } from "@/components/theme-provider";

// Runner names are often Cyrillic, so every face loads the cyrillic subset.
const display = Fira_Sans_Extra_Condensed({
  variable: "--font-display-face",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
});
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1a18" },
  ],
};

export const metadata: Metadata = {
  title: { default: "Steppe RUN", template: "%s | Steppe RUN" },
  description: "Race results, rankings and runner profiles from Kazakhstan's road and trail races.",
};

const FOOTER_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refund", label: "Refunds" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${display.variable} ${plexSans.variable} ${plexMono.variable} font-sans antialiased min-h-screen bg-background overflow-x-clip`}
      >
        <ThemeProvider>
          <Nav />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16 sm:pt-10">{children}</main>
          <footer className="border-t border-rule/80">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
              <p>
                <span className="headline text-sm text-foreground">Steppe RUN</span>
                <span className="mx-2">·</span>
                Results from almaty-marathon.kz and athletex.kz
                <span className="mx-2">·</span>
                BTS Team, {new Date().getFullYear()}
              </p>
              <nav className="flex gap-4">
                {FOOTER_LINKS.map(({ href, label }) => (
                  <Link key={href} href={href} className="hover:text-foreground underline-offset-4 hover:underline">
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
