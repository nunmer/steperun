"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

const links = [
  { href: "/",          label: "Home"      },
  { href: "/rankings",  label: "Rankings"  },
  { href: "/events",    label: "Events"    },
  { href: "/runners",           label: "Runners"      },
  { href: "/power-rankings",        label: "Power Rankings" },
  { href: "/runners/head-to-head", label: "Head to Head" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  function signIn() {
    setSigningIn(true);
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  function signOut() {
    supabase.auth.signOut().then(() => {
      setUser(null);
      window.location.href = "/";
    });
  }

  if (signingIn) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Signing you in…</p>
      </div>
    );
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex h-14 items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight shrink-0">
          🏃 Steppe RUN
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth button (desktop) */}
        <div className="hidden md:flex items-center gap-2 ml-2">
          {user ? (
            <>
              <Link
                href="/profile"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Profile
              </Link>
              <button
                onClick={signOut}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signIn}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign in
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t px-4 py-3 space-y-1 bg-background">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={signOut}
              className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {user.email?.split("@")[0]} · Sign out
            </button>
          ) : (
            <button
              onClick={signIn}
              className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground"
            >
              Sign in
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
