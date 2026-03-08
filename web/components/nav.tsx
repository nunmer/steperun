"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/",          label: "Home"      },
  { href: "/rankings",  label: "Rankings"  },
  { href: "/events",    label: "Events"    },
  { href: "/runners",           label: "Runners"      },
  { href: "/runners/head-to-head", label: "Head to Head" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex h-14 items-center gap-6">
        <Link href="/" className="font-bold text-lg tracking-tight shrink-0">
          🏃 Steperun
        </Link>
        <nav className="flex gap-1">
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
      </div>
    </header>
  );
}
