"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface RunnerHit {
  id: number;
  full_name: string;
  country: string | null;
  city: string | null;
}

interface Item {
  key: string;
  href: string;
  label: string;
  meta: string;
}

// Labels and blurbs: common.search.jump.<key>.
const JUMP_TO = [
  { key: "events", href: "/events" },
  { key: "rankings", href: "/rankings" },
  { key: "power", href: "/power-rankings" },
  { key: "h2h", href: "/runners/head-to-head" },
  { key: "coach", href: "/run-analyzer" },
] as const;

/**
 * Runner search as a command palette: opens from the nav, "/" or Ctrl/⌘+K.
 * Empty query lists the sections; typing searches runners (Latin or Cyrillic).
 * Arrow keys move, Enter opens, Esc closes.
 */
export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("common.search");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<RunnerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);

  // Debounced runner lookup.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/runners/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) {
          setHits(await res.json());
          setCursor(0);
        }
      } catch {
        // aborted by the next keystroke, or offline — keep the last results
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(id);
    };
  }, [open]);

  if (!open) return null;

  const searching = query.trim().length >= 2;
  const items: Item[] = searching
    ? hits.map((r) => ({
        key: String(r.id),
        href: `/runners/${r.id}`,
        label: r.full_name,
        meta: [r.city, r.country].filter(Boolean).join(", "),
      }))
    : JUMP_TO.map(({ key, href }) => ({ key, href, label: t(`jump.${key}.label`), meta: t(`jump.${key}.meta`) }));

  function close() {
    setQuery("");
    setHits([]);
    setCursor(0);
    onClose();
  }

  function go(item: Item | undefined) {
    if (!item) {
      if (searching) {
        router.push(`/runners?q=${encodeURIComponent(query.trim())}`);
        close();
      }
      return;
    }
    router.push(item.href);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, Math.max(items.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[cursor]); }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#141210]/70 animate-in fade-in-0 duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t("dialog")}
    >
      <div
        className="mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-2xl bg-background text-foreground border-2 border-rule animate-in slide-in-from-top-2 fade-in-0 duration-200"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b-2 border-rule px-4">
          <span aria-hidden className="time text-sm text-primary">/</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("inputLabel")}
            className="h-16 flex-1 min-w-0 bg-transparent headline text-3xl normal-case placeholder:text-muted-foreground/60 outline-none"
          />
          {loading && <span className="eyebrow">…</span>}
          <button onClick={close} className="eyebrow hover:text-foreground">{t("esc")}</button>
        </div>

        <p className="eyebrow px-4 pt-3 pb-1">
          {searching ? (hits.length ? t("runners") : loading ? t("searching") : t("noMatch")) : t("jumpTo")}
        </p>
        <ul className="max-h-[50vh] overflow-y-auto pb-2">
          {items.map((item, i) => (
            <li key={item.key}>
              <button
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(item)}
                className={cn(
                  "w-full grid grid-cols-[1.75rem_1fr_auto] items-baseline gap-3 px-4 py-2.5 text-left transition-colors",
                  i === cursor ? "bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                <span className={cn("time text-xs", i === cursor ? "text-primary" : "text-muted-foreground")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate font-medium">{item.label}</span>
                <span className={cn("truncate text-xs", i === cursor ? "text-background/70" : "text-muted-foreground")}>
                  {item.meta}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {searching && (
          <button
            onClick={() => go(undefined)}
            className="w-full border-t px-4 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground"
          >
            {t("allResults", { query: query.trim() })}
          </button>
        )}
        <div className="hidden sm:flex gap-5 border-t px-4 py-2 eyebrow">
          <span>{t("move")}</span><span>{t("open")}</span><span>{t("close")}</span>
        </div>
      </div>
    </div>
  );
}
