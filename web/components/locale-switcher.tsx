"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { LOCALE_LABELS, LOCALE_NAMES, LOCALES } from "@/i18n/config";
import { setLocaleAction } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/** Stores the chosen language in a cookie and re-renders the page in it. */
function useChooseLocale() {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const choose = (locale: string) => {
    if (locale === current) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  };
  return { current, choose, pending };
}

/** Desktop bar: one compact "RU ▾" button, so long KZ labels still fit. */
export function LocaleMenu({ className }: { className?: string }) {
  const t = useTranslations("common.nav");
  const { current, choose, pending } = useChooseLocale();

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={t("language")}
        className={cn(
          "group inline-flex items-center gap-0.5 h-9 px-1.5 rounded-sm time text-[11px] font-semibold leading-none outline-none text-foreground/70 hover:text-foreground hover:bg-foreground/10 data-[state=open]:bg-foreground/10 transition-colors",
          pending && "opacity-60",
          className,
        )}
      >
        {LOCALE_LABELS[current]}
        <ChevronDown size={12} className="opacity-60 transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={10}
          className="z-[60] min-w-40 py-1 bg-popover text-popover-foreground border border-rule/60 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.35)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
        >
          {LOCALES.map((locale) => (
            <DropdownMenu.Item
              key={locale}
              lang={locale}
              onSelect={() => choose(locale)}
              className="grid grid-cols-[1.75rem_1fr_auto] items-center px-3 py-2 text-sm outline-none cursor-default data-[highlighted]:bg-foreground data-[highlighted]:text-background"
            >
              <span className="time text-[11px] opacity-60">{LOCALE_LABELS[locale]}</span>
              <span>{LOCALE_NAMES[locale]}</span>
              {locale === current ? <Check size={14} /> : <span />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Mobile menu: the three languages side by side. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common.nav");
  const { current, choose, pending } = useChooseLocale();

  return (
    <div role="group" aria-label={t("language")} className={cn("flex items-center gap-1", pending && "opacity-60", className)}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          onClick={() => choose(locale)}
          aria-pressed={locale === current}
          title={LOCALE_NAMES[locale]}
          className={cn(
            "time h-9 px-2.5 rounded-sm text-xs leading-none transition-colors",
            locale === current ? "bg-foreground text-background font-semibold" : "text-foreground/60 hover:text-foreground",
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
