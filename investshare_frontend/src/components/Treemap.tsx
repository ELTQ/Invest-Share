// src/components/Treemap.tsx
import React from "react";
import { Treemap, ResponsiveContainer, Tooltip, Rectangle } from "recharts";
import type { AllocationItem } from "@/types";
import { fmt } from "@/lib/num";

type Props = {
  data?: AllocationItem[];
  height?: number;
};

type NodeDatum = {
  ticker: string;
  name: string;
  value: number;   // $ value (tile area)
  weight: number;  // %
  day_pct: number; // 24h change pct (used for color + tooltip)
};

function colorFor(pct: number, isCash: boolean) {
  if (isCash) return "#D1D5DB"; // cash: neutral gray
  if (pct > 0) return "#16A34A"; // green
  if (pct < 0) return "#DC2626"; // red
  return "#9CA3AF"; // flat-ish
}

function textColorFor(fill: string) {
  // white text on strong green/red; dark text on grays
  return fill === "#16A34A" || fill === "#DC2626" ? "#FFFFFF" : "#111827";
}

/**
 * Tooltip: unchanged layout/labels (still shows "Today"),
 * but the value provided is the 24h change from the backend.
 */
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.payload ?? payload[0];
  const d: any = raw?.payload ?? raw;
  if (!d) return null;

  const ticker = typeof d.ticker === "string" ? d.ticker : d.name ?? "—";
  const weight = Number.isFinite(d.weight) ? d.weight : 0;
  const value = Number.isFinite(d.value) ? d.value : 0;
  const dayPct = Number.isFinite(d.day_pct) ? d.day_pct : 0;

  return (
    <div className="rounded-md border border-stroke-soft bg-white/95 shadow-sm p-2 text-xs">
      <div className="font-medium">{ticker}</div>
      <div className="mt-1 space-y-0.5">
        <div>Weight: <span className="tnum">{fmt(weight, 2)}%</span></div>
        <div>Value: <span className="tnum">${fmt(value, 2)}</span></div>
        <div>
          Today:{" "}
          <span
            className={`tnum ${
              dayPct > 0 ? "text-success-600" : dayPct < 0 ? "text-danger-600" : "text-text-muted"
            }`}
          >
            {dayPct > 0 ? "+" : ""}{fmt(dayPct, 2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

const CellContent = (props: any) => {
  const { x, y, width, height } = props;
  const raw = props?.payload?.payload ?? props?.payload ?? props;

  const ticker =
    (typeof raw?.ticker === "string" && raw.ticker) ||
    (typeof raw?.name === "string" && raw.name) ||
    (typeof props?.name === "string" && props.name) ||
    "—";

  const pct = Number.isFinite(raw?.day_pct) ? Number(raw.day_pct) : 0;
  const isCash = ticker === "CASH";
  const fill = colorFor(pct, isCash);

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

export function AllocationTreemap({ data, height = 320 }: Props) {
  const nodes: NodeDatum[] = React.useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data
      .filter((d): d is AllocationItem => !!d && typeof (d as any).ticker === "string")
      .map((d) => {
        const value = Number((d as any).value ?? 0);
        const weight = Number((d as any).weight ?? 0);
        // Use backend-provided 24h change (get_change_24h_pct) consistently:
        const day_pct =
          (d as any).ticker === "CASH" ? 0 : Number((d as any).change_pct ?? 0);

        return {
          ticker: (d as any).ticker,
          name: (d as any).ticker,
          value: Number.isFinite(value) && value >= 0 ? value : 0,
          weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
          day_pct: Number.isFinite(day_pct) ? day_pct : 0,
        };
      })
      .filter((n) => n.value >= 0);
  }, [data]);

  if (!nodes.length) {
    return <div className="card p-6 text-sm text-text-muted">No allocation data.</div>;
  }

  return (
    <div className="card p-3">
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <Treemap
            data={nodes}
            dataKey="value"
            aspectRatio={4 / 3}
            content={<CellContent />}
            isAnimationActive={false}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-text-muted">
        Colors reflect 24-hour move (pre/regular/post). Green = up, Red = down, Gray = cash/unchanged.
      </div>
    </div>
  );
}

export default AllocationTreemap;
