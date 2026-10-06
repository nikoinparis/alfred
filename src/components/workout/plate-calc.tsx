"use client";

import { useState } from "react";
import { NumberField, Segmented } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { plateLoad } from "@/lib/domain/progression";
import { formatNumber } from "@/lib/domain/units";
import type { Unit } from "@/lib/domain/types";

/** Muted takes on competition plate colours. */
const PLATE_STYLE: Record<string, { bg: string; h: number }> = {
  "25": { bg: "#8f3a35", h: 100 },
  "20": { bg: "#34557a", h: 100 },
  "15": { bg: "#a5832f", h: 88 },
  "10": { bg: "#3d6b4f", h: 76 },
  "5": { bg: "#c9ccd1", h: 60 },
  "2.5": { bg: "#30353d", h: 50 },
  "1.25": { bg: "#8d939c", h: 42 },
  "45": { bg: "#34557a", h: 100 },
  "35": { bg: "#a5832f", h: 92 },
};

export function PlateCalculator({
  open,
  onClose,
  initial,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  initial: number | null;
  unit: Unit;
}) {
  const [total, setTotal] = useState<number | null>(initial);
  const [bar, setBar] = useState<string>(unit === "kg" ? "20" : "45");
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setTotal(initial);
  }
  const load = total ? plateLoad(total, unit, Number(bar)) : null;
  const barOptions = unit === "kg" ? ["20", "15", "10"] : ["45", "35", "25"];

  return (
    <Sheet open={open} onClose={onClose} title="Plate calculator" description="Plates per side of the bar.">
      <div className="grid gap-3">
        <NumberField label="Total weight" value={total} onChange={setTotal} step={unit === "kg" ? 2.5 : 5} suffix={unit} big />
        <Segmented
          label="Bar weight"
          value={bar}
          onChange={setBar}
          options={barOptions.map((b) => ({ value: b, label: `${b} ${unit} bar` }))}
          size="sm"
        />
      </div>
      {load && (
        <div className="mt-6">
          <div className="flex h-28 items-center" aria-hidden>
            <div className="h-3 w-10 rounded-l bg-[#6b737e]" />
            <div className="h-7 w-2 bg-[#8b939e]" />
            {load.perSide.map((p, i) => {
              const st = PLATE_STYLE[String(p)] ?? { bg: "#555", h: 50 };
              return (
                <div
                  key={i}
                  className="mx-[1px] grid w-4 place-items-center rounded-[3px] text-[9px] font-semibold text-white/80 [writing-mode:vertical-rl]"
                  style={{ height: st.h, background: st.bg }}
                >
                  {formatNumber(p)}
                </div>
              );
            })}
            <div className="h-3 flex-1 rounded-r bg-[#6b737e]" />
          </div>
          <p className="mt-3 text-[15px]">
            {load.perSide.length ? (
              <>
                Each side: <span className="readout text-xl font-semibold">{load.perSide.map(formatNumber).join(" + ")}</span> {unit}
              </>
            ) : (
              "Just the bar."
            )}
          </p>
          {load.remainder > 0 && (
            <p className="mt-1 text-sm text-ochre">
              Closest you can load is {formatNumber(load.achieved)} {unit} ({formatNumber(load.remainder)} short).
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
