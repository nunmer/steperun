import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: { default: "Steppe RUN", template: "%s | Steppe RUN" },
  description: "Runners database — results, rankings, and profiles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
        <ThemeProvider>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
          <footer className="border-t mt-16 py-6 text-center text-sm text-muted-foreground">
            Steppe RUN © {new Date().getFullYear()} · With love, BTS Team
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
