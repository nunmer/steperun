"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface AdminNavItem {
  href: string;
  label: string;
  /** Items waiting for an admin (pending claims, open disputes). */
  count?: number;
}

/** Section index for /admin: underlined text links, scrolls sideways on phones. */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex items-baseline gap-5 border-b mb-8 overflow-x-auto [scrollbar-width:none] -mx-4 px-4 sm:mx-0 sm:px-0">
      <span className="eyebrow shrink-0">Admin</span>
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap py-3 text-sm border-b-2 -mb-px transition-colors",
              active ? "border-primary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {!!item.count && (
              <span className="time text-[11px] ml-1.5 px-1 rounded-sm bg-primary text-primary-foreground">{item.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
