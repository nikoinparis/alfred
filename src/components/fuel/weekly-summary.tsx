"use client";

import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MacroTargets } from "@/lib/domain/nutrition";
import type { FoodLog } from "@/lib/db/schema";
import { sumLogs } from "@/lib/db/nutrition";
import { addDays, parseISODate } from "@/lib/domain/dates";

export function WeeklySummary({ logs, endDate, targets }: { logs: FoodLog[]; endDate: string; targets: MacroTargets }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(endDate, i - 6));
  const data = days.map((d) => {
    const t = sumLogs(logs.filter((l) => l.date === d));
    return { date: d, kcal: Math.round(t.kcal), protein: Math.round(t.protein) };
  });
  const logged = data.filter((d) => d.kcal > 0);
  const avg = (k: "kcal" | "protein") => (logged.length ? Math.round(logged.reduce((a, d) => a + d[k], 0) / logged.length) : 0);
  const proteinHit = logged.filter((d) => d.protein >= targets.protein * 0.95).length;

  return (
    <div className="panel p-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="readout text-[30px] font-semibold">{avg("kcal") || "–"}</p>
          <p className="text-xs text-fog">avg kcal / logged day</p>
        </div>
        <div>
          <p className="readout text-[30px] font-semibold">{avg("protein") || "–"}</p>
          <p className="text-xs text-fog">avg protein (g)</p>
        </div>
        <div>
          <p className="readout text-[30px] font-semibold">
            {proteinHit}
            <span className="text-lg text-fog">/{logged.length}</span>
          </p>
          <p className="text-xs text-fog">days protein hit</p>
        </div>
      </div>
      <div className="mt-4 h-40" role="img" aria-label="Calories per day for the last 7 days against target">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--steel)" strokeDasharray="2 4" />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--fog)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => format(parseISODate(d), "EEEEE")}
            />
            <YAxis
              tick={{ fill: "var(--fog)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, (max: number) => Math.ceil((Math.max(max, targets.kcal) * 1.1) / 500) * 500]}
            />
            <Tooltip
              cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-[10px] border border-steel-2 bg-gunmetal-2 px-3 py-2 text-sm shadow-xl">
                    <p className="text-xs text-fog">{format(parseISODate(p.date), "EEE d MMM")}</p>
                    <p>
                      <span className="readout text-lg">{p.kcal}</span> kcal · {p.protein} g protein
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={targets.kcal}
              stroke="var(--signal)"
              strokeDasharray="4 4"
              label={{ value: "target", fill: "var(--signal)", fontSize: 10, position: "insideTopRight" }}
            />
            <Bar
              dataKey="kcal"
              fill="var(--steel-2)"
              activeBar={{ fill: "var(--fog-2)" }}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
