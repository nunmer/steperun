type Slice = { label: string; count: number };

/**
 * Ranked horizontal bars: label, count, share. Reads faster than a donut and
 * keeps every value visible without hovering (and works on touch).
 */
export function Breakdown({ title, data, max = 5 }: { title: string; data: Slice[]; max?: number }) {
  if (data.length === 0) return null;
  const total = data.reduce((sum, s) => sum + s.count, 0);
  const top = data.slice(0, max);
  const rest = data.slice(max).reduce((sum, s) => sum + s.count, 0);
  const rows = rest > 0 ? [...top, { label: `${data.length - max} more`, count: rest }] : top;
  const largest = Math.max(...top.map((s) => s.count), 1);

  return (
    <div>
      <h3 className="eyebrow border-b border-rule pb-1.5">{title}</h3>
      <ul className="mt-2 space-y-2">
        {rows.map((s, i) => {
          const isRest = rest > 0 && i === rows.length - 1;
          return (
            <li key={s.label} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className={isRest ? "text-muted-foreground truncate" : "truncate"}>{s.label}</span>
                <span className="time text-xs text-muted-foreground">
                  {s.count.toLocaleString()}
                  <span className="inline-block w-10 text-right">{Math.round((s.count / total) * 100)}%</span>
                </span>
              </div>
              {!isRest && (
                <div className="mt-1 h-1 bg-muted">
                  <div
                    className={i === 0 ? "h-full bg-primary" : "h-full bg-foreground/60"}
                    style={{ width: `${(s.count / largest) * 100}%` }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
