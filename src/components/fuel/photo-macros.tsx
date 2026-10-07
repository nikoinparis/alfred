"use client";
/* eslint-disable @next/next/no-img-element -- previews are local data: URLs, nothing for next/image to optimise */

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImagePlus, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { NumberField, TextInput } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { FoodLog } from "@/lib/db/schema";
import { compressImage } from "@/lib/image";
import { uid } from "@/lib/id";
import { DEMO_ESTIMATE, type MealEstimate } from "@/lib/vision-schema";
import { cn } from "@/lib/cn";
import { MacroLine } from "./add-food-sheet";

type Item = MealEstimate["items"][number] & { key: string };
export interface Photo {
  base64: string;
  dataUrl: string;
}

/** How the sheet opens: with a photo to describe, or with a description to estimate straight away. */
export interface MealStart {
  photo?: Photo;
  note?: string;
  auto?: boolean;
}
type Stage =
  | { kind: "compose" }
  | { kind: "analyzing" }
  | { kind: "draft"; items: Item[]; low: number; high: number; confidence: number; notes: string; demo: boolean }
  | { kind: "error"; message: string; locked?: boolean };

const EXAMPLES = [
  "Kellogg's Corn Flakes, 40 g with 200 ml full-cream milk",
  "Nasi padang: rice, rendang, daun singkong",
  "2 eggs fried in butter",
];

export function PhotoMacrosSheet({ open, onClose, date, start }: { open: boolean; onClose: () => void; date: string; start?: MealStart }) {
  const { db, mode, ownerVerified } = useApp();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>(start?.auto ? { kind: "analyzing" } : { kind: "compose" });
  const [photo, setPhoto] = useState<Photo | null>(start?.photo ?? null);
  const [note, setNote] = useState(start?.note ?? "");
  const [refine, setRefine] = useState("");
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const sample = mode === "demo" || ownerVerified === false;

  const close = () => {
    onClose();
    setTimeout(() => {
      setStage({ kind: "compose" });
      setPhoto(null);
      setNote("");
      setRefine("");
    }, 300);
  };

  const pick = async (file: File) => {
    try {
      const img = await compressImage(file);
      setPhoto({ base64: img.base64, dataUrl: img.dataUrl });
    } catch {
      toast({ message: "Couldn't read that image. Try a JPEG or PNG.", tone: "danger" });
    }
  };

  /** Ask the model (or, in demo mode, return a sample). Callers set the "analyzing" stage first. */
  const runEstimate = async (description: string, img: Photo | null) => {
    if (sample) {
      await new Promise((r) => setTimeout(r, 1400));
      setStage(toDraft(img ? DEMO_ESTIMATE : demoFromText(description), true));
      return;
    }
    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(img ? { image: img.base64, mediaType: "image/jpeg" } : {}),
          note: description.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { estimate?: MealEstimate; error?: string };
      if (!res.ok || !data.estimate) {
        setStage({ kind: "error", message: data.error ?? "Estimate failed.", locked: res.status === 401 });
        return;
      }
      setStage(toDraft(data.estimate, false));
    } catch {
      setStage({ kind: "error", message: "You're offline. Estimates need a connection; log it from My foods for now." });
    }
  };

  const estimate = (description: string) => {
    setStage({ kind: "analyzing" });
    return runEstimate(description, photo);
  };

  // Opened from the Fuel "What did you eat?" box: estimate right away.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!start?.auto || autoStarted.current) return;
    autoStarted.current = true;
    void runEstimate(start.note ?? "", start.photo ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the opening request
  }, []);

  const save = async (s: Extract<Stage, { kind: "draft" }>) => {
    const total = s.items.reduce((a, i) => a + i.kcal, 0) || 1;
    const now = Date.now();
    const logs: FoodLog[] = s.items.map((i, n) => ({
      id: uid("fl"),
      date,
      createdAt: now + n,
      name: i.name,
      servings: 1,
      kcal: Math.round(i.kcal),
      protein: Math.round(i.protein * 10) / 10,
      carbs: Math.round(i.carbs * 10) / 10,
      fat: Math.round(i.fat * 10) / 10,
      source: photo ? "photo" : "ai",
      confidence: i.confidence,
      kcalRange: [Math.round((s.low * i.kcal) / total), Math.round((s.high * i.kcal) / total)],
    }));
    await db.foodLogs.bulkPut(logs);
    toast({
      message: `Logged ${logs.length} item${logs.length === 1 ? "" : "s"}.`,
      action: { label: "Undo", onClick: () => db.foodLogs.bulkDelete(logs.map((l) => l.id)) },
    });
    close();
  };

  const canEstimate = Boolean(photo);
  const draft = stage.kind === "draft" ? stage : null;

  return (
    <Sheet
      open={open}
      onClose={close}
      size="lg"
      closeLabel="Cancel"
      title={photo ? "Snap a meal" : "Describe a meal"}
      footer={
        stage.kind === "compose" ? (
          <Button variant="primary" size="lg" className="w-full" disabled={!canEstimate} onClick={() => estimate(note)}>
            <Sparkles className="size-5" /> Estimate macros
          </Button>
        ) : draft ? (
          <Button variant="primary" size="lg" className="w-full" disabled={!draft.items.length} onClick={() => save(draft)}>
            Save {Math.round(draft.items.reduce((a, i) => a + i.kcal, 0))} kcal
          </Button>
        ) : undefined
      }
    >
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) pick(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={libRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) pick(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {stage.kind === "compose" && (
        <div className="grid gap-4">
          {sample && (
            <p className="rounded-[12px] bg-ice/10 px-3.5 py-2.5 text-sm text-ice">
              {mode === "demo"
                ? "Demo: you'll get a sample estimate and nothing leaves your device."
                : "AI is locked on this device, so you'll get a sample. "}
              {mode !== "demo" && (
                <Link href="/settings" className="font-semibold underline underline-offset-2">
                  Unlock in Settings
                </Link>
              )}
            </p>
          )}

          {photo ? (
            <>
              <div className="relative overflow-hidden rounded-[16px]">
                <img src={photo.dataUrl} alt="Your meal" className="max-h-64 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute right-2 top-2 h-9 rounded-full bg-black/70 px-3 text-sm font-semibold text-bone ring-1 ring-white/15"
                >
                  Retake
                </button>
              </div>
              <label className="block">
                <span className="mb-1.5 block px-1 text-sm font-semibold text-bone">What is it?</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={600}
                  autoFocus
                  placeholder="Brand, amount, how it was cooked"
                  className="w-full resize-none rounded-[12px] bg-white/[0.07] px-3.5 py-3 text-base outline-none ring-signal/60 placeholder:text-fog/70 focus:bg-white/[0.1] focus:ring-1"
                />
                <span className="mt-1.5 block px-1 text-xs text-fog">
                  The more specific, the better the read. A brand lets Claude use the real label.
                </span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setNote((n) => (n ? `${n}. ${ex}` : ex))}
                    className="pressable rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-fog-2"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => camRef.current?.click()}
                  className="pressable flex h-36 flex-col items-center justify-center gap-2 rounded-[16px] bg-signal text-base font-semibold text-signal-ink"
                >
                  <Camera className="size-8" /> Take photo
                </button>
                <button
                  type="button"
                  onClick={() => libRef.current?.click()}
                  className="pressable flex h-36 flex-col items-center justify-center gap-2 rounded-[16px] bg-white/[0.07] text-base font-semibold"
                >
                  <ImagePlus className="size-8 text-signal" /> Choose photo
                </button>
              </div>
              <ol className="grid gap-1 px-1 text-sm text-fog">
                <li>1. Snap your plate.</li>
                <li>2. Say what it is: brand, amount, how it was cooked.</li>
                <li>3. Check Claude&apos;s estimate and save.</li>
              </ol>
            </>
          )}
          <p className="px-1 text-xs text-fog">Photos are shrunk to 1024 px on your phone before upload and aren&apos;t stored anywhere.</p>
        </div>
      )}

      {stage.kind === "analyzing" && <Scanning preview={photo?.dataUrl} text={note} />}

      {stage.kind === "error" && (
        <div className="grid gap-3">
          <p className="text-base text-[#f3a59e]">{stage.message}</p>
          {stage.locked && (
            <Link href="/settings" className="text-sm font-semibold text-signal">
              Unlock in Settings → Access
            </Link>
          )}
          <Button onClick={() => setStage({ kind: "compose" })}>Back</Button>
        </div>
      )}

      {draft && (
        <Draft
          stage={draft}
          preview={photo?.dataUrl}
          onChange={setStage}
          refine={refine}
          onRefineChange={setRefine}
          onRefine={() => {
            const combined = [note, refine].filter((x) => x.trim()).join(". ");
            setNote(combined);
            setRefine("");
            estimate(combined);
          }}
          onRestart={() => setStage({ kind: "compose" })}
        />
      )}
    </Sheet>
  );
}

/** Demo-mode stand-in for a text estimate, so the flow can be tried without an API key. */
function demoFromText(text: string): MealEstimate {
  const name = text.trim()
    ? text
        .trim()
        .replace(/^./, (c) => c.toUpperCase())
        .slice(0, 60)
    : "Your meal";
  return {
    items: [{ name, portion: "1 typical Indonesian serving", grams: 250, kcal: 450, protein: 20, carbs: 52, fat: 17, confidence: 0.5 }],
    kcalLow: 350,
    kcalHigh: 560,
    confidence: 0.5,
    notes: "Sample estimate (demo). With AI unlocked, Claude sizes this to a typical Indonesian portion.",
  };
}

function toDraft(e: MealEstimate, demo: boolean): Stage {
  return {
    kind: "draft",
    demo,
    items: e.items.map((i) => ({ ...i, key: uid("it") })),
    low: e.kcalLow,
    high: e.kcalHigh,
    confidence: e.confidence,
    notes: e.notes,
  };
}

function Scanning({ preview, text }: { preview?: string; text: string }) {
  return (
    <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-[16px] bg-white/[0.04]">
      {preview ? (
        <img src={preview} alt="Your meal" className="max-h-72 w-full object-cover opacity-70" />
      ) : (
        <p className="max-w-sm px-6 text-center text-base text-fog-2">&ldquo;{text}&rdquo;</p>
      )}
      <motion.div
        className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-signal/30 to-transparent"
        initial={{ top: "-25%" }}
        animate={{ top: ["-25%", "100%"] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <p className="material absolute bottom-3 rounded-full px-3 py-1 text-sm">Estimating…</p>
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const label = value >= 0.75 ? "High" : value >= 0.5 ? "Medium" : "Low";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        value >= 0.75 ? "bg-verdigris/15 text-verdigris" : value >= 0.5 ? "bg-ochre/15 text-ochre" : "bg-crimson/15 text-[#f3a59e]",
      )}
    >
      {label} confidence
    </span>
  );
}

function Draft({
  stage,
  preview,
  onChange,
  refine,
  onRefineChange,
  onRefine,
  onRestart,
}: {
  stage: Extract<Stage, { kind: "draft" }>;
  preview?: string;
  onChange: (s: Stage) => void;
  refine: string;
  onRefineChange: (v: string) => void;
  onRefine: () => void;
  onRestart: () => void;
}) {
  const total = stage.items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat }), {
    kcal: 0,
    p: 0,
    c: 0,
    f: 0,
  });
  const update = (key: string, patch: Partial<Item>) =>
    onChange({ ...stage, items: stage.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  const pct = total.kcal ? Math.round(((stage.high - stage.low) / 2 / total.kcal) * 100) : 0;

  return (
    <div className="grid gap-4">
      <div className="flex gap-3">
        {preview && <img src={preview} alt="Your meal" className="size-24 shrink-0 rounded-[14px] object-cover" />}
        <div className="min-w-0">
          <p className="readout text-[44px] font-semibold">{Math.round(total.kcal)}</p>
          <p className="text-sm text-fog">
            kcal · likely {stage.low}–{stage.high} (±{pct}%)
          </p>
          <div className="mt-1.5">
            <Confidence value={stage.confidence} />
          </div>
        </div>
      </div>
      {stage.demo && <p className="text-xs text-ice">Sample estimate. Real photos and descriptions go to Claude once AI is unlocked.</p>}
      {stage.notes && <p className="text-sm text-fog-2">{stage.notes}</p>}
      <MacroLine kcal={total.kcal} p={total.p} c={total.c} f={total.f} />

      <div className="flex gap-2">
        <TextInput
          value={refine}
          onChange={(e) => onRefineChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refine.trim() && onRefine()}
          placeholder="Add a detail, e.g. it's Kellogg's"
          aria-label="Add a detail and re-estimate"
        />
        <Button variant="tinted" disabled={!refine.trim()} onClick={onRefine}>
          Re-estimate
        </Button>
      </div>

      <ul className="grid gap-2">
        <AnimatePresence initial={false}>
          {stage.items.map((i) => (
            <motion.li
              key={i.key}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="panel p-3"
            >
              <div className="flex items-center gap-2">
                <TextInput
                  value={i.name}
                  onChange={(e) => update(i.key, { name: e.target.value })}
                  className="h-10 flex-1"
                  aria-label="Item name"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${i.name}`}
                  onClick={() => onChange({ ...stage, items: stage.items.filter((x) => x.key !== i.key) })}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <p className="mt-1.5 flex items-center gap-2 px-1 text-xs text-fog">
                {i.portion}
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    i.confidence >= 0.75 ? "bg-verdigris" : i.confidence >= 0.5 ? "bg-ochre" : "bg-crimson",
                  )}
                />
                {Math.round(i.confidence * 100)}% sure
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {(
                  [
                    ["kcal", "kcal", 10],
                    ["protein", "Protein", 1],
                    ["carbs", "Carbs", 1],
                    ["fat", "Fat", 1],
                  ] as const
                ).map(([k, label, step]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-center text-[11px] text-fog">{label}</span>
                    <NumberField
                      label={`${i.name} ${label}`}
                      value={Math.round(i[k])}
                      step={step}
                      dense
                      className="[&_button]:w-6 [&_input]:text-lg"
                      onChange={(v) => update(i.key, { [k]: v ?? 0 })}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                {[0.5, 0.75, 1.25, 1.5].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      update(i.key, { kcal: i.kcal * m, protein: i.protein * m, carbs: i.carbs * m, fat: i.fat * m, grams: i.grams * m })
                    }
                    className="pressable h-9 flex-1 rounded-full bg-white/[0.06] text-xs font-semibold text-fog-2"
                  >
                    ×{m}
                  </button>
                ))}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() =>
            onChange({
              ...stage,
              items: [
                ...stage.items,
                {
                  key: uid("it"),
                  name: "Something missed",
                  portion: "your estimate",
                  grams: 0,
                  kcal: 100,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  confidence: 1,
                },
              ],
            })
          }
        >
          <Plus className="size-4" /> Add item
        </Button>
        <Button variant="ghost" className="flex-1" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  );
}
