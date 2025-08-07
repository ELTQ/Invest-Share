// src/components/Treemap.tsx
import React from "react";
import { Treemap, ResponsiveContainer, Tooltip, Rectangle } from "recharts";
import type { AllocationItem, Holding } from "@/types";
import { fmt } from "@/lib/num";

type Props = {
  data?: AllocationItem[];
  metrics?: Holding[] | null;   // optional; used only if you pass holdings with day_pct
  height?: number;
};

type NodeDatum = {
  ticker: string;
  name: string;
  value: number;    // $ value → also drives tile area
  weight: number;   // %
  day_pct: number;  // intraday %
};

function colorFor(pct: number, isCash: boolean) {
  if (isCash) return "#D1D5DB";          // gray for cash
  if (pct > 0) return "#16A34A";         // green
  if (pct < 0) return "#DC2626";         // red
  return "#9CA3AF";                      // neutral gray
}

function textColorFor(fill: string) {
  return fill === "#16A34A" || fill === "#DC2626" ? "#FFFFFF" : "#111827";
}

/** Keep the tooltip EXACTLY as before (no changes requested) */
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.payload ?? payload[0];   // recharts sometimes wraps
  const d: any = raw?.payload ?? raw;
  if (!d) return null;

  const ticker = d.ticker || d.name || "—";
  return (
    <div className="rounded-md border border-stroke-soft bg-white/95 shadow-sm p-2 text-xs">
      <div className="font-medium">{ticker}</div>
      <div className="mt-1 space-y-0.5">
        <div>Weight: <span className="tnum">{fmt(d.weight ?? 0, 2)}%</span></div>
        <div>Value: <span className="tnum">${fmt(d.value ?? 0, 2)}</span></div>
        <div>
          Today:{" "}
          <span className={`tnum ${d.day_pct > 0 ? "text-success-600" : d.day_pct < 0 ? "text-danger-600" : "text-text-muted"}`}>
            {d.day_pct > 0 ? "+" : ""}{fmt(d.day_pct || 0, 2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

/** Only show color + TICKER on tiles (no extra text) */
const CellContent = (props: any) => {
  const { x, y, width, height } = props;
  const raw = props?.payload?.payload ?? props?.payload ?? props;
  const ticker = raw?.ticker || raw?.name || props?.name || "—";
  const pct = Number(raw?.day_pct ?? 0);
  const isCash = ticker === "CASH";
  const fill = colorFor(pct, isCash);

  // Small tiles: still show ticker if there's minimal room
  const showText = width >= 30 && height >= 18;

  return (
    <g>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} stroke="#FFFFFF" strokeWidth={1} />
      {showText && (
        <text
          x={x + 6}
          y={y + 14}
          fill={textColorFor(fill)}
          fontSize={11}
          fontWeight={600}
          pointerEvents="none"
        >
          {ticker}
        </text>
      )}
    </g>
  );
};

export function AllocationTreemap({ data, metrics, height = 320 }: Props) {
  // Optional map from holdings for intraday % if you pass it
  const fromHoldings = React.useMemo(() => {
    const m = new Map<string, number>();
    (metrics || []).forEach((h: any) => {
      if (!h?.ticker) return;
      const v = Number(h.day_pct ?? 0);
      if (Number.isFinite(v)) m.set(h.ticker, v);
    });
    return m;
  }, [metrics]);

  const nodes: NodeDatum[] = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data
      .filter((d): d is AllocationItem => !!d && typeof (d as any).ticker === "string")
      .map((d) => {
        const value = Number((d as any).value ?? 0) || 0;
        const weight = Number((d as any).weight ?? 0) || 0;
        const fallbackPct = Number((d as any).change_pct ?? 0) || 0;
        const day_pct = (d as any).ticker === "CASH"
          ? 0
          : (fromHoldings.get((d as any).ticker) ?? fallbackPct);

        return {
          ticker: (d as any).ticker,
          name: (d as any).ticker,
          value,
          weight,
          day_pct,
        };
      })
      .filter((n) => Number.isFinite(n.value) && n.value >= 0);
  }, [data, fromHoldings]);

  if (!nodes.length) {
    return <div className="card p-6 text-sm text-text-muted">No allocation data.</div>;
  }

  return (
    <div className="card p-3">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <Treemap
            data={nodes}
            dataKey="value"          // size tiles by $ value
            aspectRatio={4 / 3}
            content={<CellContent />}
            isAnimationActive={false}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-text-muted">
        Colors reflect intraday move (today’s open → now). Green = up, Red = down, Gray = cash/unchanged.
      </div>
    </div>
  );
}

export default AllocationTreemap;
