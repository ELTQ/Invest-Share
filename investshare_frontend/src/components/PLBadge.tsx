import { toNum } from "@/lib/num";

export function PLBadge({ abs, pct }: { abs?: number | string | null; pct?: number | string | null }) {
  const nPct = toNum(pct);
  const nAbs = abs == null ? null : toNum(abs);
  const positive = nPct >= 0;
  return (
    <span className={`rounded-md px-2 py-1 text-sm tnum ${positive ? "bg-brand-50 text-success-500" : "bg-red-50 text-danger-500"}`}>
      {positive ? "+" : ""}{nPct.toFixed(2)}% {nAbs != null ? `(${nAbs >= 0 ? "+" : ""}$${nAbs.toFixed(2)})` : ""}
    </span>
  );
}
