import { roundTo, toKg } from "./units";
import type { DayTemplate, DayType, TemplateSlot } from "./types";

/** Seed weights were given in lbs; store them in kg rounded to 0.5 kg. */
const lb = (v: number) => ({ value: roundTo(toKg(v, "lb"), 0.5), unit: "kg" as const });

let n = 0;
function slot(
  exerciseId: string,
  sets: number,
  repMin: number,
  repMax: number,
  target: TemplateSlot["target"] = null,
  alternates: string[] = [],
  note?: string,
): TemplateSlot {
  n += 1;
  return { id: `slot-${n}`, exerciseId, sets, repMin, repMax, target, alternates, note };
}

export function seedTemplates(): DayTemplate[] {
  n = 0;
  return [
    {
      dayType: "push",
      name: "Push",
      slots: [
        slot("chest-press", 3, 8, 8, lb(160), ["bench-press", "db-chest-press", "incline-db-press"], "Total load (both dumbbells)"),
        slot("incline-cable-fly", 3, 8, 8, lb(80), ["cable-chest-fly", "pec-deck"]),
        slot("lateral-raise", 3, 8, 8, lb(12.5), ["cable-lateral-raise"]),
        slot("cable-triceps-ext", 3, 8, 8, lb(57.5), ["overhead-triceps-ext"]),
        slot("forearm-work", 3, 8, 8, lb(47.5)),
      ],
    },
    {
      dayType: "pull",
      name: "Pull",
      slots: [
        slot("cable-row", 3, 8, 8, lb(130), ["seated-cable-row"]),
        slot(
          "lat-pulldown",
          3,
          8,
          8,
          lb(130),
          ["assisted-pullup", "wide-lat-pulldown", "pullup"],
          "Assisted pull-up option: 25 lb assistance",
        ),
        slot("face-pull", 3, 8, 8, lb(65)),
        slot("biceps-curl", 3, 8, 8, null, ["hammer-curl"]),
        slot("hanging-leg-raise", 3, 12, 12, null, ["ab-wheel", "cable-crunch"]),
      ],
    },
    {
      dayType: "legs",
      name: "Legs",
      slots: [
        slot("squat", 3, 8, 8, lb(165), ["front-squat", "leg-press"]),
        slot("walking-lunge", 3, 8, 8, null, ["bulgarian-split-squat"], "Reps per leg"),
        slot("seated-leg-curl", 3, 8, 8, null, ["lying-leg-curl"]),
        slot("hamstring-curl", 3, 8, 8, null, ["lying-leg-curl"]),
        slot("standing-calf-raise", 3, 12, 15, lb(35), ["seated-calf-raise"]),
        slot("rdl", 3, 8, 8, lb(55)),
      ],
    },
    {
      dayType: "upper",
      name: "Upper",
      slots: [
        slot("db-chest-press", 3, 8, 10, lb(160), ["bench-press", "incline-db-press"], "Total load (both dumbbells)"),
        slot("wide-lat-pulldown", 3, 8, 10, lb(120), ["lat-pulldown", "assisted-pullup"]),
        slot("cable-chest-fly", 2, 12, 12, lb(35), ["pec-deck"]),
        slot("seated-cable-row", 3, 10, 10, lb(130), ["cable-row"]),
        slot("ab-wheel", 3, 10, 10, null, ["cable-crunch"]),
      ],
    },
    {
      dayType: "lower",
      name: "Lower",
      slots: [
        slot("rdl", 4, 6, 8),
        slot("front-squat", 3, 8, 10, null, ["bulgarian-split-squat"]),
        slot("hip-thrust", 3, 10, 10),
        slot("lying-leg-curl", 2, 12, 12, null, ["seated-leg-curl"]),
        slot("seated-calf-raise", 3, 15, 15, null, ["standing-calf-raise"]),
        slot("pallof-press", 2, 12, 12, null, [], "Reps per side"),
      ],
    },
    {
      dayType: "rest",
      name: "Rest & Mobility",
      slots: [slot("incline-walk", 1, 1, 1, null, ["light-walk"]), slot("stretch-foam", 1, 1, 1)],
    },
  ];
}

export const DAY_TYPES_ORDER: DayType[] = ["push", "pull", "legs", "upper", "lower", "rest"];
