// src/lib/num.ts
export function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(String(v));
}
export function fmt(v: unknown, digits = 2): string {
  return toNum(v).toFixed(digits);
}
