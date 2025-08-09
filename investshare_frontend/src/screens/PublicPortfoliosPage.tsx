import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Pagination } from "@/components/Pagination";
import { Input } from "@/components/Input";
import { fmt, toNum } from "@/lib/num";

type PublicPortfolio = {
  id: number;
  owner_username?: string;
  total_value: number;
  todays_change: { abs: number; pct: number };
};

type PageResult<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export function PublicPortfoliosPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const pageSize = 12;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-portfolios", page],
    queryFn: async () =>
      apiFetch<PageResult<PublicPortfolio>>(
        `/api/public-portfolios/?page=${page}&page_size=${pageSize}`
      ),
    keepPreviousData: true,
    staleTime: 20_000,
  });

  const items = useMemo(() => data?.results ?? [], [data?.results]);
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / pageSize));

  // Client-side filter on the current page (backend doesn’t support ?q=)
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((p) =>
      (p.owner_username || "user").toLowerCase().includes(term)
    );
  }, [items, q]);

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-10">Loading…</div>;
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="card p-6">
          <div className="text-lg font-medium">Public portfolios unavailable</div>
          <p className="text-sm text-text-muted mt-1">Please try again shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Public Portfolios</h1>
          <p className="text-sm text-text-muted">Live total value & today’s P/L</p>
        </div>
        <Input
          placeholder="Search user…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // keep same page; or setPage(1) if you prefer
          }}
          style={{ width: 220 }}
        />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const tv = toNum(p.total_value);
          const abs = toNum(p.todays_change?.abs ?? 0);
          const pct = toNum(p.todays_change?.pct ?? 0);
          const pos = pct > 0;
          const neg = pct < 0;
          const pnlClass =
            pos ? "text-success-600 text-green-600"
            : neg ? "text-danger-600 text-red-600"
            : "text-text-muted";
          const pnlStyle = pos ? { color: "#16A34A" } : neg ? { color: "#DC2626" } : undefined;


          return (
            <Link
              key={p.id}
              to={`/portfolio/${p.id}`}
              className="card p-4 block hover:shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <div className="text-sm text-text-muted">@{p.owner_username ?? "user"}</div>
              <div className="mt-1 text-2xl font-semibold tnum">${fmt(tv, 2)}</div>
              <div className="mt-1 text-sm tnum" style={pnlStyle}>
                <span className={pnlClass}>
                  {abs >= 0 ? "+" : "-"}${fmt(Math.abs(abs), 2)} ({pct >= 0 ? "+" : ""}{fmt(pct, 2)}%)
                </span>
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full">
            <div className="card p-6 text-sm text-text-muted">No matching portfolios.</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          Page <span className="tnum">{page}</span> of <span className="tnum">{totalPages}</span>
        </div>
        <Pagination current={page} total={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}

export default PublicPortfoliosPage;
