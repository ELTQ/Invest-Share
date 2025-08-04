import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, post, del } from "@/lib/api";
import type {
  Portfolio, PublicPortfolioRow, AllocationResponse, Paginated, Trade, PortfolioChartPoint
} from "@/types";

type QOpts = { enabled?: boolean };

export function usePublicPortfolios(page = 1) {
  return useQuery({
    queryKey: ["public-portfolios", page],
    queryFn: () => apiFetch<Paginated<PublicPortfolioRow>>(`/api/public-portfolios/?page=${page}`),
  });
}

export function usePortfolio(id: number, opts: QOpts = {}) {
  return useQuery({
    queryKey: ["portfolio", id],
    queryFn: () => apiFetch<Portfolio>(`/api/portfolios/${id}/`),
    enabled: opts.enabled !== false,
  });
}

export function useAllocations(id: number, opts: QOpts = {}) {
  return useQuery({
    queryKey: ["allocations", id],
    queryFn: () => apiFetch<AllocationResponse>(`/api/portfolios/${id}/allocations/`),
    enabled: opts.enabled !== false,
  });
}

export function useChart(id: number, range: string, opts: QOpts = {}) {
  return useQuery({
    queryKey: ["chart", id, range],
    queryFn: () => apiFetch<PortfolioChartPoint[]>(`/api/portfolios/${id}/chart/?range=${range}`),
    enabled: opts.enabled !== false,
  });
}

export function useTrades(id: number, page = 1, opts: QOpts = {}) {
  return useQuery({
    queryKey: ["trades", id, page],
    queryFn: () => apiFetch<Paginated<Trade>>(`/api/portfolios/${id}/trades/?page=${page}`),
    enabled: opts.enabled !== false,
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; visibility: "public" | "private" }) =>
      post<Portfolio>("/api/portfolios/", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-portfolios"] });
    },
  });
}

export function useDeletePortfolio(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del(`/api/portfolios/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-portfolios"] });
    },
  });
}

export function useCashIn(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      post<{ trade: Trade; portfolio: Portfolio }>(`/api/portfolios/${id}/trades/cash-in/`, { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", id] });
      qc.invalidateQueries({ queryKey: ["allocations", id] });
      qc.invalidateQueries({ queryKey: ["trades", id] });
    },
  });
}

export function useBuy(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ticker: string; quantity: number }) =>
      post<{ trade: Trade; portfolio: Portfolio }>(`/api/portfolios/${id}/trades/buy/`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", id] });
      qc.invalidateQueries({ queryKey: ["allocations", id] });
      qc.invalidateQueries({ queryKey: ["trades", id] });
    },
  });
}

export function useSell(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ticker: string; quantity: number }) =>
      post<{ trade: Trade; portfolio: Portfolio }>(`/api/portfolios/${id}/trades/sell/`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", id] });
      qc.invalidateQueries({ queryKey: ["allocations", id] });
      qc.invalidateQueries({ queryKey: ["trades", id] });
    },
  });
}
