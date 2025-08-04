import { Button } from "@/components/Button";

type Props = {
  current: number;          // current page (1-based)
  total: number;            // total pages
  onChange: (page: number) => void;
  disabled?: boolean;       // disable while loading
};

// Build a compact page list with ellipses.
// Example: 1 … 4 5 [6] 7 8 … 20
function makePages(current: number, total: number, spread = 1): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total]);

  // current ± spread, and edges around them
  for (let p = current - spread; p <= current + spread; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  // little buffer near edges
  pages.add(2);
  pages.add(total - 1);

  const list = Array.from(pages).sort((a, b) => a - b);
  const out: (number | string)[] = [];
  for (let i = 0; i < list.length; i++) {
    out.push(list[i]);
    if (i < list.length - 1 && list[i + 1] !== list[i] + 1) out.push("…");
  }
  return out;
}

export function Pagination({ current, total, onChange, disabled }: Props) {
  const pages = makePages(current, total, 1);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        disabled={disabled || current <= 1}
        onClick={() => onChange(1)}
        aria-label="First page"
      >
        «
      </Button>
      <Button
        variant="ghost"
        disabled={disabled || current <= 1}
        onClick={() => onChange(current - 1)}
        aria-label="Previous page"
      >
        Prev
      </Button>

      {pages.map((p, idx) =>
        typeof p === "string" ? (
          <span
            key={`gap-${idx}`}
            className="px-2 text-text-muted select-none"
            aria-hidden
          >
            {p}
          </span>
        ) : (
          <Button
            key={p}
            variant={p === current ? "primary" : "ghost"}
            disabled={disabled || p === current}
            onClick={() => onChange(p)}
            aria-current={p === current ? "page" : undefined}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="ghost"
        disabled={disabled || current >= total}
        onClick={() => onChange(current + 1)}
        aria-label="Next page"
      >
        Next
      </Button>
      <Button
        variant="ghost"
        disabled={disabled || current >= total}
        onClick={() => onChange(total)}
        aria-label="Last page"
      >
        »
      </Button>
    </div>
  );
}
