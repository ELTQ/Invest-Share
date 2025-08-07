export interface Holding {
  id: number;
  ticker: string;
  quantity: number | string;   // was number
  avg_cost: number | string;   // was number

  value?: number | string | null;
  pl_abs?: number | string | null;
  pl_pct?: number | string | null;
  day_abs?: number | string | null;
  day_pct?: number | string | null;
}


export interface Change {
  abs: number | string | null;
  pct: number | string | null;
}

export interface Portfolio {
  id: number;
  name: string;
  visibility: "public" | "private";
  cash: number | string;
  owner_username: string;
  total_value: number | string;
  todays_change: Change;
  holdings: Holding[];
  created_at: string;
}

export interface Trade {
  id: number;
  type: "BUY" | "SELL" | "CASH_IN" | "CASH_OUT" | "SHORT_COVER";
  ticker: string;
  quantity: number | string;   // was number
  price: number | string;      // was number
  cash_delta: number | string; // was number
  executed_at: string;
}


export interface PublicPortfolioRow {
  id: number;
  owner_username: string;
  total_value: number;
  todays_change: Change;
}


export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TickerDetail {
  ticker: string;
  market_cap: number | null;
  pe: number | null;
  eps: number | null;
  price: number;
  change_abs: number | null;
  change_pct: number | null;
}

export interface PortfolioChartPoint { date: string; value: number; }
export interface AllocationItem {
  ticker: string;
  weight: number | string;
  value: number | string;         // signed
  change_pct?: number | string | null;
  position?: "long" | "short" | "cash";
}
export interface AllocationResponse { total: number | string; data: AllocationItem[]; }
