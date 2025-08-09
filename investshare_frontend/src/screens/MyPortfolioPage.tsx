// src/screens/MyPortfolioPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAllocations,
  useBuy,
  useCashIn,
  useCashOut,
  useChart,
  useDeletePortfolio,
  usePortfolio,
  useTrades,
  useCreatePortfolio,
  useSell,
} from "@/hooks/usePortfolios";
import { fmt, toNum } from "@/lib/num";
import { apiFetch } from "@/lib/api";
import { LineValueChart } from "@/components/LineChart";
import { AllocationTreemap } from "@/components/Treemap";
import { Tabs } from "@/components/Tabs";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PLBadge } from "@/components/PLBadge";
import { me } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { Portfolio } from "@/types";
import { Pagination } from "@/components/Pagination";

const rangeTabs = [
  { key: "1d", label: "Day" },
  { key: "1w", label: "Week" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "Year" },
  { key: "all", label: "All" },
];

// very basic whitelist: letters/numbers/dot/dash only, 1–20 chars
const TICKER_RE = /^[A-Z0-9.\-]{1,20}$/;

export function MyPortfolioPage() {
  const nav = useNavigate();
  const [pid, setPid] = useState<number | null>(null);
  const [range, setRange] = useState("all");
  const [tradePage, setTradePage] = useState(1);

  // who am I?
  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: me });

  // fetch *my* portfolio directly (fast + avoids flicker)
  const mineQ = useQuery({
    queryKey: ["my-portfolio"],
    enabled: !!meData?.username, // wait for auth known
    retry: false,
    queryFn: async () => {
      try {
        return await apiFetch<Portfolio>("/api/portfolios/mine/", { auth: true });
      } catch (e: any) {
        // propagate HTTP status so we can differentiate 404 vs others
        e.status = e?.status ?? e?.response?.status ?? 0;
        throw e;
      }
    },
  });

  // set local pid when data arrives (kept for hooks & deletes)
  useEffect(() => {
    if (mineQ.data?.id) setPid(mineQ.data.id);
  }, [mineQ.data?.id]);

  // reset pagination when portfolio changes
  useEffect(() => {
    setTradePage(1);
  }, [pid]);

  // init if missing
  const createPortfolio = useCreatePortfolio();

  // data queries (guarded)
  const { data: pf } = usePortfolio(pid ?? 0, { enabled: pid != null });
  const { data: alloc } = useAllocations(pid ?? 0, { enabled: pid != null });
  const { data: chart } = useChart(pid ?? 0, range, { enabled: pid != null });
  const { data: trades, isFetching } = useTrades(pid ?? 0, tradePage, { enabled: pid != null });

  const pageSize = 10;
  const totalTrades = trades?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));
  const tradeRows = useMemo(() => trades?.results ?? [], [trades?.results]);

  // mutations
  const cashIn = useCashIn(pid ?? 0);
  const cashOut = useCashOut(pid ?? 0);
  const buy = useBuy(pid ?? 0);
  const sell = useSell(pid ?? 0);
  const del = useDeletePortfolio(pid ?? 0);

  // trade form
  const [ticker, setTicker] = useState("");
  const [cashAmt, setCashAmt] = useState("");
  const [cashOutAmt, setCashOutAmt] = useState("");
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"BUY" | "SELL">("BUY");
  const currentCash = toNum(pf?.cash ?? 0);

  // block rendering until we know auth + whether user has a portfolio
  if (!meData || mineQ.isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-10">Loading…</div>;
  }

  const noPortfolio = mineQ.isError && (mineQ as any).error?.status === 404;

  // Create portfolio screen (only after confirmed 404)
  if (noPortfolio && pid == null) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h2 className="text-2xl font-semibold">Create your portfolio</h2>
        <div className="card p-4 space-y-3">
          <p className="text-text-muted">You don’t have a portfolio yet.</p>
          <Button
            onClick={() => {
              createPortfolio.mutate(
                { name: "My Portfolio", visibility: "public" },
                {
                  onSuccess: (p) => {
                    const id = (p as any)?.id;
                    if (id) setPid(id);
                  },
                }
              );
            }}
            loading={createPortfolio.isPending}
          >
            Initialize portfolio
          </Button>
          {createPortfolio.error && (
            <p className="text-danger-500 text-sm">Could not create portfolio.</p>
          )}
        </div>
      </div>
    );
  }

  const tradePending = buy.isPending || sell.isPending;
  const tradeError = buy.error || sell.error;

  // derived validity
  const cleanedTicker = ticker.toUpperCase().trim();
  const qtyNum = Number(qty);
  const tickerValid = TICKER_RE.test(cleanedTicker);
  const qtyValid = Number.isFinite(qtyNum) && qtyNum > 0;

  const tradeDisabled = !tickerValid || !qtyValid || tradePending || pid == null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="text-sm text-text-muted">My Portfolio</div>
        <h1 className="text-3xl font-semibold tnum">${fmt(toNum(pf?.total_value ?? 0), 2)}</h1>
        <PLBadge
          abs={toNum(pf?.todays_change?.abs ?? 0)}
          pct={toNum(pf?.todays_change?.pct ?? 0)}
        />
      </header>

      <div className="flex flex-wrap gap-3">
        {/* Add Cash */}
        <div className="card p-4 space-y-3 w-full max-w-md">
          <h3 className="font-medium">Add Cash</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Amount"
              inputMode="decimal"
              value={cashAmt}
              onChange={(e) => setCashAmt(e.target.value)}
            />
            <Button
              onClick={() =>
                cashIn.mutate(Number(cashAmt || 0), {
                  onSuccess: () => {
                    setCashAmt("");
                    setTradePage(1);
                  },
                })
              }
              disabled={!cashAmt || Number(cashAmt) <= 0 || cashIn.isPending || pid == null}
              loading={cashIn.isPending}
            >
              Add
            </Button>
          </div>
          {cashIn.error && <p className="text-danger-500 text-sm">Cash in failed.</p>}
        </div>

        {/* Remove Cash */}
        <div className="card p-4 space-y-3 w-full max-w-md">
          <h3 className="font-medium">Remove Cash</h3>

          <div className="flex gap-2">
            <Input
              placeholder={`Up to $${fmt(currentCash, 2)}`}
              inputMode="decimal"
              value={cashOutAmt}
              onChange={(e) => setCashOutAmt(e.target.value)}
            />
            <Button
              onClick={() =>
                cashOut.mutate(Number(cashOutAmt || 0), {
                  onSuccess: () => {
                    setCashOutAmt("");
                    setTradePage(1);
                  },
                })
              }
              disabled={
                !cashOutAmt ||
                Number(cashOutAmt) <= 0 ||
                Number(cashOutAmt) > currentCash ||
                cashOut.isPending ||
                pid == null
              }
              loading={cashOut.isPending}
              variant="danger"
            >
              Remove
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              onClick={() => {
                if (currentCash <= 0) return;
                if (confirm(`Remove ALL cash ($${fmt(currentCash, 2)})?`)) {
                  cashOut.mutate(currentCash, {
                    onSuccess: () => {
                      setCashOutAmt("");
                      setTradePage(1);
                    },
                  });
                }
              }}
              disabled={currentCash <= 0 || cashOut.isPending || pid == null}
            >
              Remove All
            </Button>
            <span className="text-xs text-text-muted">
              You currently have ${fmt(currentCash, 2)} cash.
            </span>
          </div>

          {Number(cashOutAmt) > currentCash && (
            <p className="text-danger-500 text-xs">Amount exceeds available cash.</p>
          )}
          {cashOut.error && <p className="text-danger-500 text-sm">Cash out failed.</p>}
        </div>

        {/* Trade (Buy/Sell) */}
        <div className="card p-4 space-y-3 w-full max-w-md">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Trade (market price)</h3>
            <div className="inline-flex rounded-lg border border-stroke-soft p-1 bg-bg-surface">
              <button
                className={`px-3 py-1.5 text-sm rounded-md ${
                  mode === "BUY" ? "bg-brand text-white" : "hover:bg-white"
                }`}
                onClick={() => setMode("BUY")}
                type="button"
              >
                Buy
              </button>
              <button
                className={`px-3 py-1.5 text-sm rounded-md ${
                  mode === "SELL" ? "bg-brand text-white" : "hover:bg-white"
                }`}
                onClick={() => setMode("SELL")}
                type="button"
              >
                Sell
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
            <Input
              placeholder="Qty"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <Button
              onClick={() => {
                if (tradeDisabled) return;
                const onSuccess = () => {
                  setTicker("");
                  setQty("");
                  setTradePage(1);
                };
                const payload = { ticker: cleanedTicker, quantity: qtyNum };
                if (mode === "BUY") buy.mutate(payload, { onSuccess });
                else sell.mutate(payload, { onSuccess });
              }}
              disabled={tradeDisabled}
              loading={tradePending}
            >
              Trade
            </Button>
          </div>
          {!tickerValid && ticker.length > 0 && (
            <p className="text-warning-600 text-xs">Ticker looks invalid.</p>
          )}
          {!qtyValid && qty.length > 0 && (
            <p className="text-warning-600 text-xs">Quantity must be a positive number.</p>
          )}
          {tradeError && (
            <p className="text-danger-500 text-sm">
              {mode === "BUY" ? "Buy" : "Sell"} failed.
            </p>
          )}
          <p className="text-xs text-text-muted">
            Executes at current market price (incl. after-hours when available). Manual price entry
            is disabled.
          </p>
        </div>

        <div className="flex-1" />

        {/* Danger zone */}
        <div className="card p-4 space-y-3 w-full max-w-md">
          <h3 className="font-medium text-danger-500">Danger zone</h3>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Delete portfolio? This cannot be undone.")) {
                del.mutate(undefined, {
                  onSuccess: () => {
                    setPid(null);
                    nav("/public");
                  },
                });
              }
            }}
            disabled={del.isPending || pid == null}
            loading={del.isPending}
          >
            Delete portfolio
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Performance</h3>
        <Tabs value={range} onChange={setRange} items={rangeTabs} />
      </div>
      <LineValueChart data={chart} />

      <h3 className="text-lg font-medium">Allocation</h3>
      <AllocationTreemap data={alloc?.data ?? []} metrics={pf?.holdings ?? []} />

      {/* Positions */}
      <h3 className="text-lg font-medium">Positions</h3>
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface text-left text-text-muted">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Avg Cost</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">P/L $</th>
              <th className="px-4 py-3">P/L %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-soft">
            {pf?.holdings?.map((h: any) => (
              <tr key={h.id}>
                <td className="px-4 py-3">{h.ticker}</td>
                <td className="px-4 py-3 tnum">{fmt(toNum(h.quantity), 4)}</td>
                <td className="px-4 py-3 tnum">${fmt(toNum(h.avg_cost), 4)}</td>
                <td className="px-4 py-3 tnum">
                  {h.value != null ? `$${fmt(toNum(h.value), 2)}` : "-"}
                </td>
                <td
                  className={`px-4 py-3 tnum ${
                    toNum(h.pl_abs) >= 0 ? "text-success-600" : "text-danger-600"
                  }`}
                >
                  {h.pl_abs != null
                    ? `${toNum(h.pl_abs) >= 0 ? "+" : ""}$${fmt(toNum(h.pl_abs), 2)}`
                    : "-"}
                </td>
                <td
                  className={`px-4 py-3 tnum ${
                    toNum(h.pl_pct) >= 0 ? "text-success-600" : "text-danger-600"
                  }`}
                >
                  {h.pl_pct != null
                    ? `${toNum(h.pl_pct) >= 0 ? "+" : ""}${fmt(toNum(h.pl_pct), 2)}%`
                    : "-"}
                </td>
              </tr>
            ))}
            {(!pf?.holdings || pf.holdings.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={6}>
                  No positions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Trades */}
      <h3 className="text-lg font-medium">Trades</h3>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
        <div className="text-sm">
          Page <span className="tnum">{tradePage}</span> of{" "}
          <span className="tnum">{totalPages}</span>
        </div>

        <Pagination
          current={tradePage}
          total={totalPages}
          onChange={(p) => setTradePage(p)}
          disabled={isFetching}
        />

        <div className="flex items-center gap-2">
          <Input
            style={{ width: 110 }}
            placeholder="Go to page"
            value={String(tradePage)}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, "");
              const num = v ? Math.min(Math.max(1, parseInt(v, 10)), totalPages) : 1;
              setTradePage(num);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setTradePage((p) => Math.min(Math.max(1, p), totalPages));
              }
            }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface text-left text-text-muted">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Cash Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-soft">
            {(tradeRows || []).map((t: any) => (
              <tr key={t.id}>
                <td className="px-4 py-3">
                  {t.executed_at ? new Date(t.executed_at).toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3">{t.type}</td>
                <td className="px-4 py-3">{t.ticker || "-"}</td>
                <td className="px-4 py-3 tnum">{fmt(toNum(t.quantity), 4)}</td>
                <td className="px-4 py-3 tnum">
                  {t.price ? `$${fmt(toNum(t.price), 4)}` : "-"}
                </td>
                <td className="px-4 py-3 tnum">
                  {toNum(t.cash_delta) >= 0 ? "+" : ""}${fmt(toNum(t.cash_delta), 2)}
                </td>
              </tr>
            ))}
            {(!tradeRows || tradeRows.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={6}>
                  No trades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
