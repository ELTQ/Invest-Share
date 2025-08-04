import { usePublicPortfolios } from "@/hooks/usePortfolios";
import { Link } from "react-router-dom";
import { PLBadge } from "@/components/PLBadge";
import { fmt } from "@/lib/num";

export function PublicPortfoliosPage() {
  const { data, isLoading, error } = usePublicPortfolios(1);

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-danger-500">Failed to load.</p>;
  const rows = data?.results ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Public Portfolios</h2>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-surface text-left text-sm text-text-muted">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Portfolio Value</th>
              <th className="px-4 py-3">Today</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-soft">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-bg-surface">
                <td className="px-4 py-3">
                  <Link to={`/portfolio/${r.id}`} className="text-brand">{r.owner_username}</Link>
                </td>
                <td className="px-4 py-3 tnum">${fmt(r.total_value, 2)}</td>
                <td className="px-4 py-3">
                  <PLBadge abs={r.todays_change?.abs ?? 0} pct={r.todays_change?.pct ?? 0}/>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-4 py-6 text-text-muted" colSpan={3}>No public portfolios yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
