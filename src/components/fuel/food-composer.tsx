"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUp, BookOpen, Camera, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { useToast } from "@/components/ui/toast";
import { logFood } from "@/lib/db/nutrition";
import type { Food, FoodLog } from "@/lib/db/schema";
import { matchSavedFoods } from "@/lib/domain/food-match";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/cn";
import type { Photo } from "./photo-macros";

const USUALS = 6;

function amount(servings: number) {
  return servings === 1 ? "" : `${servings} × `;
}

/**
 * One place to log food. Your usual foods are one tap; typing a saved food ("2 kellogs") logs it
 * straight from My foods with no AI call. Anything else goes to Claude (Indonesian portions), and
 * the camera snaps a photo.
 */
export function FoodComposer({
  date,
  onDescribe,
  onPhoto,
  onBrowse,
}: {
  date: string;
  onDescribe: (text: string) => void;
  onPhoto: (photo: Photo) => void;
  onBrowse: () => void;
}) {
  const { db } = useApp();
  const toast = useToast();
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const ready = text.trim().length > 1;
  const foods = useLiveQuery(() => db.foods.toArray(), [db]);
  const usuals = (foods ?? [])
    .filter((f) => f.lastUsed || f.favorite)
    .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0) || Number(b.favorite) - Number(a.favorite))
    .slice(0, USUALS);

  const quickLog = async (items: { food: Food; servings: number }[]) => {
    const logs: FoodLog[] = [];
    for (const { food, servings } of items) logs.push(await logFood(db, date, food, servings));
    const kcal = logs.reduce((a, l) => a + l.kcal, 0);
    toast({
      message: `Logged ${items.map((i) => amount(i.servings) + i.food.name).join(", ")} (${kcal} kcal)`,
      action: { label: "Undo", onClick: () => db.foodLogs.bulkDelete(logs.map((l) => l.id)) },
    });
  };

  const submit = () => {
    if (!ready) return;
    const said = text.trim();
    setText("");
    const matched = matchSavedFoods(said, foods ?? []);
    if (matched) void quickLog(matched);
    else onDescribe(said);
  };

  return (
    <section className="panel p-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.07] text-signal active:scale-95"
          aria-label="Snap or choose a photo of your meal"
        >
          <Camera className="size-5" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={1500}
          placeholder="What did you eat?"
          aria-label="Describe what you ate"
          enterKeyHint="send"
          className="field-sizing-content max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-[22px] bg-white/[0.07] px-4 py-2.5 text-base leading-6 outline-none ring-signal/60 placeholder:text-fog/80 focus:ring-1"
        />
        <button
          type="submit"
          disabled={!ready}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full transition-colors active:scale-95",
            ready ? "bg-signal text-signal-ink" : "bg-white/[0.07] text-fog/60",
          )}
          aria-label="Estimate macros"
        >
          <ArrowUp className="size-5" strokeWidth={2.5} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const img = await compressImage(f);
              onPhoto({ base64: img.base64, dataUrl: img.dataUrl });
            } catch {
              toast({ message: "Couldn't read that image. Try a JPEG or PNG.", tone: "danger" });
            }
          }}
        />
      </form>
      <div className="no-scrollbar -mx-3 mt-2.5 flex gap-1.5 overflow-x-auto px-3">
        <button
          type="button"
          onClick={onBrowse}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-signal-soft px-3 text-sm font-semibold text-signal active:scale-[0.97]"
        >
          <BookOpen className="size-4" /> My foods
        </button>
        {usuals.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => quickLog([{ food: f, servings: 1 }])}
            className="flex h-9 max-w-[11rem] shrink-0 items-center gap-1 rounded-full bg-white/[0.06] pl-2.5 pr-3 text-sm text-fog-2 active:scale-[0.97]"
            aria-label={`Log 1 serving of ${f.name}`}
          >
            <Plus className="size-3.5 shrink-0 text-signal" />
            <span className="truncate">{f.name}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs text-fog">
        Saved foods (&ldquo;2 kellogs&rdquo;) log instantly with no AI. Anything else, Claude estimates at Indonesian portions. Short on
        time? List the whole day tonight in one go.
      </p>
    </section>
  );
}
