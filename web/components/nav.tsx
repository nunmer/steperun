"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sun, Moon, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { CommandSearch } from "@/components/command-search";
import { AccountMenu } from "@/components/account-menu";
import type { User } from "@supabase/supabase-js";

const links = [
  { href: "/events",               label: "Events"         },
  { href: "/rankings",             label: "Rankings"       },
  { href: "/power-rankings",       label: "Power"          },
  { href: "/runners",              label: "Runners"        },
  { href: "/runners/head-to-head", label: "Head to head"   },
  { href: "/run-analyzer",         label: "AI Coach"       },
];

/** A section is active on its own page and on its detail pages (/events/x). */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/runners") return pathname.startsWith("/runners/") && !pathname.startsWith("/runners/head-to-head");
  return pathname.startsWith(`${href}/`);
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("headline text-[1.6rem] leading-none trim-caps", className)}>
      Steppe <span className="text-primary">RUN</span>
    </span>
  );
}

/** Scroll position → (hidden while scrolling down, solid once past the top / hero). */
function useScrollState(overHeroPage: boolean) {
  const [state, setState] = useState({ hidden: false, solid: !overHeroPage });

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const hero = overHeroPage ? document.getElementById("hero") : null;
      // Clamped: while the page streams in, the hero can measure ~0px tall.
      const solidFrom = Math.max(8, hero ? hero.offsetHeight - 64 : 8);
      const goingDown = y > lastY;
      setState({
        hidden: goingDown && y > 160,
        solid: y > solidFrom,
      });
      lastY = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [overHeroPage]);

  return state;
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  // Id of the signed-in user once /api/admin/whoami confirmed they're an admin.
  const [adminId, setAdminId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const supabase = createSupabaseBrowserClient();

  const overHeroPage = pathname === "/";
  const { hidden, solid } = useScrollState(overHeroPage);
  // Over the home video the bar is transparent and always light-on-dark.
  const transparent = overHeroPage && !solid && !open;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Admins get an Admin link; the endpoint answers 403 for everyone else.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetch("/api/admin/whoami")
      .then((r) => { if (live && r.ok) setAdminId(userId); })
      .catch(() => {});
    return () => { live = false; };
  }, [userId]);
  const isAdmin = !!userId && adminId === userId;

  // "/" or Ctrl/⌘+K opens search from anywhere except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(false);
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  if (signingIn) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <p className="eyebrow">Signing you in…</p>
      </div>
    );
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-[transform,background-color,border-color,color] duration-300",
          hidden && !open && !searchOpen ? "-translate-y-full" : "translate-y-0",
          transparent
            ? "dark bg-transparent border-b border-transparent text-foreground"
            : "bg-background border-b border-rule",
        )}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4 xl:gap-6">
          <Link href="/" onClick={() => setOpen(false)} className="shrink-0" aria-label="Steppe RUN home">
            <Wordmark />
          </Link>

          {/*
            Index-style sections: mono number and condensed label share one
            baseline; text-box trimming makes the caps, not the font's line box,
            what gets centred in the bar.
          */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7 mx-auto" aria-label="Main">
            {links.map(({ href, label }, i) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="group relative inline-flex items-baseline gap-1.5 py-2 whitespace-nowrap"
                >
                  <span className={cn("time text-[10px] leading-none trim-caps", active ? "text-primary" : "text-foreground/45")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "headline text-[1.15rem] leading-none tracking-[0.02em] trim-caps transition-colors",
                      active ? "text-foreground" : "text-foreground/65 group-hover:text-foreground",
                    )}
                  >
                    {label}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 right-0 bottom-0 h-[2px] bg-primary origin-left transition-transform duration-300",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto lg:ml-0 flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="group inline-flex items-center gap-2 h-9 px-2.5 sm:w-44 lg:w-auto xl:w-44 rounded-sm border border-foreground/20 bg-foreground/[0.03] hover:border-foreground/50 transition-colors"
              aria-label="Search runners"
            >
              <Search size={15} className="shrink-0 text-foreground/55 group-hover:text-foreground" />
              <span className="hidden sm:block lg:hidden xl:block flex-1 text-left text-sm leading-none whitespace-nowrap text-foreground/55 group-hover:text-foreground">
                Find a runner
              </span>
              <kbd className="hidden sm:inline-flex size-5 items-center justify-center rounded-[2px] border border-foreground/20 time text-[11px] leading-none text-foreground/60">
                /
              </kbd>
            </button>

            <div className="hidden lg:flex items-center gap-1">
              {user ? (
                <AccountMenu user={user} isAdmin={isAdmin} theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut} />
              ) : (
                <>
                  {mounted && (
                    <button
                      onClick={toggleTheme}
                      className="flex size-9 items-center justify-center rounded-sm text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors"
                      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    >
                      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                  )}
                  <button
                    onClick={signIn}
                    className="inline-flex items-center h-9 px-3.5 rounded-sm bg-primary text-primary-foreground text-sm font-semibold leading-none whitespace-nowrap hover:bg-primary/90 transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            {/* Two-bar burger that turns into a cross. */}
            <button
              className="lg:hidden relative size-10 -mr-2 flex items-center justify-center"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              <span className={cn("absolute h-[2px] w-6 bg-foreground transition-transform duration-300", open ? "rotate-45" : "-translate-y-1")} />
              <span className={cn("absolute h-[2px] w-6 bg-foreground transition-transform duration-300", open ? "-rotate-45" : "translate-y-1")} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile: a full-height numbered index in display type. */}
      {open && (
        <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-background overflow-y-auto border-t border-rule animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <nav className="px-4 py-2" aria-label="Main">
            {links.map(({ href, label }, i) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className="flex items-baseline gap-3 py-3 border-b"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className={cn("time text-xs w-6", active ? "text-primary" : "text-muted-foreground")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={cn("headline text-4xl", active && "text-primary")}>{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="px-4 py-5 flex items-center justify-between gap-3">
            {user ? (
              <div className="flex items-center gap-4 text-sm">
                <Link href="/profile" onClick={() => setOpen(false)} className="font-medium underline underline-offset-4">My profile</Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="font-medium underline underline-offset-4">Admin</Link>
                )}
                <button onClick={signOut} className="text-muted-foreground">Sign out</button>
              </div>
            ) : (
              <button onClick={signIn} className="h-11 px-4 rounded-sm bg-primary text-primary-foreground text-sm font-semibold">
                Sign in with Google
              </button>
            )}
            {mounted && (
              <button onClick={toggleTheme} className="flex items-center gap-2 text-sm text-muted-foreground">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? "Light" : "Dark"}
              </button>
            )}
          </div>
        </div>
      )}

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
