// src/screens/PortfolioPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  usePortfolio,
  useAllocations,
  useChart,
  usePublicTrades,
} from "@/hooks/usePortfolios";
import { Tabs } from "@/components/Tabs";
import { LineValueChart } from "@/components/LineChart";
import { AllocationTreemap } from "@/components/Treemap";
import { PLBadge } from "@/components/PLBadge";
import { Pagination } from "@/components/Pagination";
import { Input } from "@/components/Input";
import { fmt, toNum } from "@/lib/num";

const rangeTabs = [
  { key: "1d", label: "Day" },
  { key: "1w", label: "Week" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "Year" },
  { key: "all", label: "All" },
];

export function PortfolioPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const portfolioId = Number(id);
  const [range, setRange] = useState("all");
  const [tradePage, setTradePage] = useState(1);

  // Guard invalid ids without calling navigate() during render
  useEffect(() => {
    if (!Number.isFinite(portfolioId) || portfolioId <= 0) {
      nav("/public", { replace: true });
    }
  }, [portfolioId, nav]);

  // Public (read-only) data
  const { data: pf, isError: pfError } = usePortfolio(portfolioId, {
    enabled: Number.isFinite(portfolioId) && portfolioId > 0,
  });
  const { data: alloc } = useAllocations(portfolioId, {
    enabled: Number.isFinite(portfolioId) && portfolioId > 0,
  });
  const { data: chart } = useChart(portfolioId, range, {
    enabled: Number.isFinite(portfolioId) && portfolioId > 0,
  });

  // Public trades, paginated (10/page, newest → oldest from server)
  const { data: trades, isFetching } = usePublicTrades(portfolioId, tradePage, {
    enabled: Number.isFinite(portfolioId) && portfolioId > 0,
  });

  const pageSize = 10;
  const totalTrades = trades?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));
  const tradeRows = useMemo(() => trades?.results ?? [], [trades?.results]);

  if (pfError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="card p-6">
          <div className="text-lg font-medium">Portfolio unavailable</div>
          <p className="text-sm text-text-muted mt-1">
            This portfolio may be private or no longer exists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <div className="text-sm text-text-muted">
          Public Portfolio{pf?.owner_username ? ` · @${pf.owner_username}` : ""}
        </div>
        <h1 className="text-3xl font-semibold tnum">
          ${fmt(toNum(pf?.total_value ?? 0), 2)}
        </h1>
        <PLBadge
          abs={toNum(pf?.todays_change?.abs ?? 0)}
          pct={toNum(pf?.todays_change?.pct ?? 0)}
        />
      </header>

      {/* Performance */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Performance</h3>
        <Tabs value={range} onChange={setRange} items={rangeTabs} />
      </div>
      <LineValueChart data={chart} />

      {/* Allocation */}
      <h3 className="text-lg font-medium">Allocation</h3>
      <AllocationTreemap data={alloc?.data ?? []} metrics={pf?.holdings ?? []} />

      {/* Positions — same columns as My Portfolio (incl. LIVE Price/Value/P&L) */}
      <h3 className="text-lg font-medium">Positions</h3>
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface text-left text-text-muted">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Avg Cost</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">P/L $</th>
              <th className="px-4 py-3">P/L %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-soft">
            {(pf?.holdings ?? []).map((h: any) => {
              const qty = toNum(h.quantity);
              // backend may not send explicit price; derive from value/qty as fallback
              const livePrice =
                h?.price != null
                  ? toNum(h.price)
                  : qty && Number.isFinite(qty) && qty !== 0 && h?.value != null
                  ? toNum(h.value) / qty
                  : NaN;

              return (
                <tr key={h.id}>
                  <td className="px-4 py-3">{h.ticker}</td>
                  <td className="px-4 py-3 tnum">{fmt(qty, 4)}</td>
                  <td className="px-4 py-3 tnum">${fmt(toNum(h.avg_cost), 4)}</td>
                  <td className="px-4 py-3 tnum">
                    {Number.isFinite(livePrice) ? `$${fmt(livePrice, 4)}` : "-"}
                  </td>
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
              );
            })}
            {(!pf?.holdings || pf.holdings.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={7}>
                  No positions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Trades — identical pagination UI (read-only) */}
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
