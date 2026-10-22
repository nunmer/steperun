"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { ChevronDown, Moon, Sun } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/profile", label: "My profile", meta: "Races, PBs, trainings" },
  { href: "/coins", label: "Coins", meta: "Balance and history" },
  { href: "/run-analyzer", label: "AI Coach", meta: "Your form analyses" },
];

function Avatar({ user, className }: { user: User; className?: string }) {
  const src = user.user_metadata?.avatar_url as string | undefined;
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "?";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" referrerPolicy="no-referrer" className={cn("object-cover shrink-0", className)} />;
  }
  return (
    <span className={cn("shrink-0 bg-primary text-primary-foreground headline flex items-center justify-center", className)}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

/**
 * Signed-in account control: avatar + first name, opening a menu with the
 * account's identity, its pages, the theme switch and sign-out.
 */
export function AccountMenu({
  user,
  theme,
  onToggleTheme,
  onSignOut,
}: {
  user: User;
  theme: string | undefined;
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Runner";
  const first = fullName.split(" ")[0];

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        className="group flex items-center gap-2 h-9 pl-1 pr-2 rounded-sm outline-none hover:bg-foreground/10 data-[state=open]:bg-foreground/10 transition-colors"
        aria-label="Account"
      >
        <Avatar user={user} className="size-7 text-base rounded-sm" />
        <span className="hidden xl:inline text-sm font-medium leading-none max-w-[8rem] truncate">{first}</span>
        <ChevronDown size={14} className="opacity-60 transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-[60] w-72 bg-popover text-popover-foreground border border-rule/60 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.35)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
        >
          {/* Identity: who is signed in. */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Avatar user={user} className="size-11 text-2xl rounded-sm" />
            <div className="min-w-0">
              <p className="headline text-xl leading-tight truncate">{fullName}</p>
              <p className="time text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <div className="py-1">
            {LINKS.map((l, i) => (
              <DropdownMenu.Item key={l.href} asChild>
                <Link
                  href={l.href}
                  className="grid grid-cols-[1.5rem_1fr_auto] items-baseline gap-2 px-4 py-2.5 outline-none data-[highlighted]:bg-foreground data-[highlighted]:text-background transition-colors group/item"
                >
                  <span className="time text-[10px] text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block text-sm font-medium">{l.label}</span>
                    <span className="block text-xs text-muted-foreground group-data-[highlighted]/item:text-background/60">{l.meta}</span>
                  </span>
                  <span aria-hidden className="text-sm">→</span>
                </Link>
              </DropdownMenu.Item>
            ))}
          </div>

          <div className="border-t py-1">
            <DropdownMenu.Item
              onSelect={(e) => { e.preventDefault(); onToggleTheme(); }}
              className="flex items-center justify-between px-4 py-2.5 text-sm outline-none cursor-default data-[highlighted]:bg-muted"
            >
              <span className="flex items-center gap-2">
                {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
                Theme
              </span>
              {/* Two-position switch: paper / night. */}
              <span className="flex border border-rule/60 text-[11px] time">
                <span className={cn("px-2 py-0.5", theme !== "dark" && "bg-foreground text-background")}>Paper</span>
                <span className={cn("px-2 py-0.5", theme === "dark" && "bg-foreground text-background")}>Night</span>
              </span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={onSignOut}
              className="px-4 py-2.5 text-sm text-muted-foreground outline-none cursor-default data-[highlighted]:bg-muted data-[highlighted]:text-destructive"
            >
              Sign out
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
