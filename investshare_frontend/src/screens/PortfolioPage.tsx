import { useParams } from "react-router-dom";
import { useAllocations, useChart, usePortfolio } from "@/hooks/usePortfolios";
import { usePublicTrades } from "@/hooks/usePortfolios";
import { LineValueChart } from "@/components/LineChart";
import { AllocationTreemap } from "@/components/Treemap";
import { Tabs } from "@/components/Tabs";
import { useState } from "react";
import { PLBadge } from "@/components/PLBadge";
import { fmt, toNum } from "@/lib/num";
import { Pagination } from "@/components/Pagination";

const rangeTabs = [
  { key: "1d", label: "Day" },
  { key: "1w", label: "Week" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "Year" },
  { key: "all", label: "All" },
];

export function PortfolioPage() {
  const { id } = useParams();
  const portfolioId = Number(id);
  const [range, setRange] = useState("all");
  const [tradePage, setTradePage] = useState(1);

  // Public (read-only) data
  const { data: pf } = usePortfolio(portfolioId);
  const { data: alloc } = useAllocations(portfolioId);
  const { data: chart } = useChart(portfolioId, range);

  // Public trades, paginated (10/page)
  const { data: trades, isFetching: tradesLoading } = usePublicTrades(
    portfolioId,
    tradePage,
    { enabled: Number.isFinite(portfolioId) }
  );

  const tradeRows = trades?.results ?? [];
  const totalTrades = trades?.count ?? 0;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="text-sm text-text-muted">{pf?.owner_username} • Portfolio</div>
        <h1 className="text-3xl font-semibold tnum">${fmt(pf?.total_value ?? 0, 2)}</h1>
        <PLBadge abs={pf?.todays_change?.abs ?? 0} pct={pf?.todays_change?.pct ?? 0} />
      </header>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Performance</h3>
        <Tabs value={range} onChange={setRange} items={rangeTabs} />
      </div>
      <LineValueChart data={chart} />

      <h3 className="text-lg font-medium">Allocation</h3>
      <AllocationTreemap data={alloc?.data} />

      <h3 className="text-lg font-medium">Positions</h3>
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface text-left text-text-muted">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Avg Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-soft">
            {pf?.holdings?.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3">{h.ticker}</td>
                <td className="px-4 py-3 tnum">{fmt(h.quantity, 4)}</td>
                <td className="px-4 py-3 tnum">${fmt(h.avg_cost, 4)}</td>
              </tr>
            ))}
            {(!pf?.holdings || pf.holdings.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={3}>
                  No positions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Trades */}
      <h3 className="text-lg font-medium">Trade history</h3>

      {/* Pagination header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
        <div className="text-sm">
          Page <span className="tnum">{tradePage}</span> of{" "}
          <span className="tnum">{totalPages}</span>
        </div>

        <Pagination
          current={tradePage}
          total={totalPages}
          onChange={(p) => setTradePage(p)}
          disabled={tradesLoading}
        />
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
            {tradeRows.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3">{new Date(t.executed_at).toLocaleString()}</td>
                <td className="px-4 py-3">{t.type}</td>
                <td className="px-4 py-3">{t.ticker || "-"}</td>
                <td className="px-4 py-3 tnum">{fmt(t.quantity, 4)}</td>
                <td className="px-4 py-3 tnum">{t.price ? `$${fmt(t.price, 4)}` : "-"}</td>
                <td className="px-4 py-3 tnum">
                  {toNum(t.cash_delta) >= 0 ? "+" : ""}${fmt(t.cash_delta, 2)}
                </td>
              </tr>
            ))}
            {tradeRows.length === 0 && (
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
