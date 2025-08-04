import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PortfolioChartPoint } from "@/types";

export function LineValueChart({ data }: { data?: PortfolioChartPoint[] }) {
  return (
    <div className="card p-4">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data || []}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00C805" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#00C805" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={60} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#00C805" fill="url(#g)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
