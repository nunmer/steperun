"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

type Runner = {
  id: number;
  full_name: string;
  country: string | null;
  city: string | null;
};

export function RunnerSearch({
  label,
  selectedRunner,
  onSelect,
}: {
  label: string;
  selectedRunner: Runner | null;
  onSelect: (runner: Runner | null) => void;
}) {
  const t = useTranslations("runners.search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Runner[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/runners/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedRunner) {
    return (
      <div className="space-y-2">
        <p className="eyebrow">
          {label}
        </p>
        <div className="flex items-center gap-3">
          <div className="size-12 bg-foreground text-background headline text-2xl flex items-center justify-center shrink-0">
            {selectedRunner.full_name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{selectedRunner.full_name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {[selectedRunner.country, selectedRunner.city].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <button
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            {t("change")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <p className="eyebrow">
        {label}
      </p>
      <div className="relative">
        <Input
          placeholder={t("placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        )}
        {open && results.length > 0 && (
          <ul className="absolute z-50 top-full mt-1 w-full bg-popover border border-rule rounded-sm max-h-60 overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
                  onClick={() => {
                    onSelect(r);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="size-7 bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                    {r.full_name[0]?.toUpperCase()}
                  </span>
                  <span className="truncate font-medium">{r.full_name}</span>
                  <span className="text-muted-foreground text-xs truncate ml-auto">
                    {[r.country, r.city].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && results.length === 0 && !loading && query.length >= 2 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-rule rounded-sm p-3 text-sm text-muted-foreground text-center">
            {t("noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
