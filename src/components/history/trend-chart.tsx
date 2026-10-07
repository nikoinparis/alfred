"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { parseISODate } from "@/lib/domain/dates";
import { formatNumber } from "@/lib/domain/units";

export interface TrendPoint {
  date: string;
  value: number;
}

const axisTick = { fill: "var(--fog)", fontSize: 11 };

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: TrendPoint }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="material rounded-[12px] px-3 py-2 ring-[0.5px] ring-white/10 shadow-xl">
      <p className="text-xs text-fog">{format(parseISODate(p.date), "EEE d MMM yyyy")}</p>
      <p className="readout mt-0.5 text-xl font-semibold text-bone">
        {formatNumber(p.value)} <span className="text-sm font-normal text-fog">{unit}</span>
      </p>
    </div>
  );
}

/** Single-series line (area) chart. One axis, no legend: the card title names the series. */
export function LineTrend({ data, unit, label }: { data: TrendPoint[]; unit: string; label: string }) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.15);
  return (
    <div className="h-48 w-full" role="img" aria-label={`${label} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="signalFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--signal)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--signal)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--steel)" strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d: string) => format(parseISODate(d), "d MMM")}
            minTickGap={24}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[Math.floor(min - pad), Math.ceil(max + pad)]} width={40} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "var(--steel-2)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--signal)"
            strokeWidth={2}
            fill="url(#signalFade)"
            dot={data.length <= 12 ? { r: 4, fill: "var(--signal)", stroke: "var(--kevlar)", strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--signal)", stroke: "var(--kevlar)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarTrend({ data, unit, label }: { data: TrendPoint[]; unit: string; label: string }) {
  return (
    <div className="h-40 w-full" role="img" aria-label={`${label} per session`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--steel)" strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d: string) => format(parseISODate(d), "d MMM")}
            minTickGap={24}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "rgb(255 255 255 / 0.04)" }} />
          <Bar
            dataKey="value"
            fill="var(--steel-2)"
            activeBar={{ fill: "var(--fog-2)" }}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
