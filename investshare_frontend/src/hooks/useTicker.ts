import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { TickerDetail } from "@/types";

export function useTicker(symbol?: string) {
  return useQuery({
    queryKey: ["ticker", symbol],
    enabled: !!symbol,
    queryFn: () => apiFetch<TickerDetail>(`/api/tickers/${symbol}/`),
  });
}

export function useTickerSearch(q: string) {
  return useQuery({
    queryKey: ["ticker-search", q],
    enabled: q.trim().length > 0,
    queryFn: () => apiFetch<{ ticker: string; exchange?: string; name?: string }[]>(`/api/tickers/search/?q=${encodeURIComponent(q)}`),
  });
}
