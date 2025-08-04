import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import type { AllocationItem } from "@/types";
import { toNum } from "@/lib/num";

export function AllocationTreemap({ data }: { data?: AllocationItem[] }) {
  const nodes = (data || []).map(d => ({ name: d.ticker, size: Math.max(toNum(d.weight), 0.0001) }));
  return (
    <div className="card p-4">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={nodes} dataKey="size" stroke="#fff" />
        </ResponsiveContainer>
      </div>
      <Tooltip />
    </div>
  );
}
