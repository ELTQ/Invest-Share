import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiFetch, post } from "@/lib/api";
import type {
  Portfolio, PublicPortfolioRow, AllocationResponse, Paginated, Trade, PortfolioChartPoint
} from "@/types";

type QOpts = { enabled?: boolean };
export function usePublicPortfolios(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: ["public-portfolios", page, pageSize],
    queryFn: () =>
      apiFetch<Paginated<PublicPortfolioRow>>(
        `/api/public-portfolios/?page=${page}&page_size=${pageSize}`
      ),
    placeholderData: (prev) => prev, // keep previous page visible while loading next
  });
}

export function usePublicTrades(id: number, page = 1, opts: { enabled?: boolean } = {}, pageSize = 10) {
  return useQuery({
    queryKey: ["public-trades", id, page, pageSize],
    queryFn: () =>
      apiFetch<Paginated<Trade>>(
        `/api/portfolios/${id}/trades/?page=${page}&page_size=${pageSize}`
      ), // no { auth: true }
    enabled: opts.enabled !== false,
    placeholderData: (prev) => prev,
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


export function useTrades(id: number, page = 1, opts: QOpts = {}, pageSize = 10) {
  return useQuery({
    queryKey: ["trades", id, page, pageSize],
    queryFn: () =>
      apiFetch<Paginated<Trade>>(
        `/api/portfolios/${id}/trades/?page=${page}&page_size=${pageSize}`
      ),
    enabled: opts.enabled !== false,

    placeholderData: keepPreviousData,
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

export function useCashOut(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      post<{ trade: Trade; portfolio: Portfolio }>(`/api/portfolios/${id}/trades/cash-out/`, { amount }),
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
