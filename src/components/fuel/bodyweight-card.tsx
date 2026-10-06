"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { useState } from "react";
import { ComposedChart, CartesianGrid, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { NumberField, Segmented } from "@/components/ui/controls";
import { useToast } from "@/components/ui/toast";
import { addDays, parseISODate } from "@/lib/domain/dates";
import { weeklyRate, weightTrend } from "@/lib/domain/nutrition";
import { convert, formatNumber, roundTo, toKg } from "@/lib/domain/units";

type Range = "30" | "90" | "365";

export function BodyweightCard({ date }: { date: string }) {
  const { db } = useApp();
  const { unit } = useSettings();
  const toast = useToast();
  const [range, setRange] = useState<Range>("90");
  const all = useLiveQuery(() => db.bodyweights.orderBy("date").toArray(), [db]);
  const todays = all?.find((w) => w.date === date);
  const last = all?.[all.length - 1];
  const [draft, setDraft] = useState<number | null>(null);
  const shown = (kg: number) => roundTo(convert(kg, "kg", unit), 0.1);
  const value = draft ?? (todays ? shown(todays.kg) : last ? shown(last.kg) : null);

  if (!all) return null;
  const trend = weightTrend(all);
  const from = addDays(date, -Number(range));
  const data = trend
    .filter((p) => p.date >= from && p.date <= date)
    .map((p) => ({ date: p.date, scale: shown(p.kg), trend: shown(p.trend) }));
  const rate = weeklyRate(all, date);
  const latestTrend = trend.length ? shown(trend[trend.length - 1].trend) : null;

  const save = async () => {
    if (value === null) return;
    await db.bodyweights.put({ date, kg: roundTo(toKg(value, unit), 0.01) });
    setDraft(null);
    toast({ message: `Weigh-in saved: ${formatNumber(value)} ${unit}.` });
  };

  const values = data.flatMap((d) => [d.scale, d.trend]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fog-2">Trend weight</p>
          <p className="readout text-[40px] font-semibold">
            {latestTrend !== null ? formatNumber(latestTrend) : "–"}
            <span className="text-lg text-fog"> {unit}</span>
          </p>
          <p className="text-sm text-fog">
            {rate === null
              ? "Weigh in on 4+ days to see your weekly rate."
              : `${rate >= 0 ? "+" : ""}${formatNumber(roundTo(convert(rate, "kg", unit), 0.01))} ${unit}/week over 14 days`}
          </p>
        </div>
        <div className="flex w-full items-end gap-2 sm:w-auto">
          <label className="flex-1 sm:w-40">
            <span className="mb-1.5 block text-xs text-fog">{todays ? "Today's weigh-in" : "Weigh in today"}</span>
            <NumberField label="Bodyweight" value={value} step={0.1} max={400} suffix={unit} onChange={setDraft} />
          </label>
          <Button variant={todays && draft === null ? "secondary" : "primary"} onClick={save} disabled={value === null}>
            {todays && draft === null ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {data.length > 1 && (
        <>
          <div className="mt-5 h-48" role="img" aria-label="Bodyweight: daily scale readings and smoothed trend">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--steel)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--fog)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d: string) => format(parseISODate(d), "d MMM")}
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: "var(--fog)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[Math.floor(min - 0.5), Math.ceil(max + 0.5)]}
                  width={36}
                />
                <Tooltip
                  cursor={{ stroke: "var(--steel-2)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof data)[number];
                    return (
                      <div className="rounded-[10px] border border-steel-2 bg-gunmetal-2 px-3 py-2 text-sm shadow-xl">
                        <p className="text-xs text-fog">{format(parseISODate(p.date), "EEE d MMM")}</p>
                        <p>
                          Scale <span className="readout text-lg">{formatNumber(p.scale)}</span>
                        </p>
                        <p className="text-signal">
                          Trend <span className="readout text-lg">{formatNumber(p.trend)}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  dataKey="scale"
                  fill="var(--fog)"
                  shape={(props: { cx?: number; cy?: number }) => (
                    <circle cx={props.cx} cy={props.cy} r={2.5} fill="var(--fog)" fillOpacity={0.7} />
                  )}
                  isAnimationActive={false}
                />
                <Line type="monotone" dataKey="trend" stroke="var(--signal)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4 text-xs text-fog-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-fog" /> Scale
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 rounded bg-signal" /> Trend
              </span>
            </div>
            <Segmented<Range>
              label="Chart range"
              value={range}
              onChange={setRange}
              size="sm"
              className="w-48"
              options={[
                { value: "30", label: "30d" },
                { value: "90", label: "90d" },
                { value: "365", label: "1y" },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
