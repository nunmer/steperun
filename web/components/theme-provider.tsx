"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Paper is the default: a results sheet reads best dark-on-light. The toggle
// in the nav still switches to the night palette.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}
