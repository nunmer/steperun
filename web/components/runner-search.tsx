"use client";

import { useState, useEffect, useRef } from "react";
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
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
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={containerRef}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <div className="relative">
        <Input
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        )}
        {open && results.length > 0 && (
          <ul className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                  <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
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
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg p-3 text-sm text-muted-foreground text-center">
            No runners found
          </div>
        )}
      </div>
    </div>
  );
}
