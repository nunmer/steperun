import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Steperun", template: "%s | Steperun" },
  description: "Almaty Marathon runner database — results, rankings, and profiles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
        <Nav />
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t mt-16 py-6 text-center text-sm text-muted-foreground">
          Steperun © {new Date().getFullYear()} · Almaty Marathon results database
        </footer>
      </body>
    </html>
  );
}
