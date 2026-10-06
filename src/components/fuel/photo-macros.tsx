"use client";
/* eslint-disable @next/next/no-img-element -- previews are local data: URLs, nothing for next/image to optimise */

import Link from "next/link";
import { motion } from "motion/react";
import { Camera, ImagePlus, Plus, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
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
type Stage =
  | { kind: "pick" }
  | { kind: "analyzing"; preview: string }
  | { kind: "draft"; preview: string; items: Item[]; low: number; high: number; confidence: number; notes: string; demo: boolean }
  | { kind: "error"; preview?: string; message: string; locked?: boolean };

export function PhotoMacrosSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const { db, mode, ownerVerified } = useApp();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [note, setNote] = useState("");
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setStage({ kind: "pick" });
      setNote("");
    }, 300);
  };

  const toDraft = (preview: string, e: MealEstimate, demo: boolean): Stage => ({
    kind: "draft",
    preview,
    demo,
    items: e.items.map((i) => ({ ...i, key: uid("it") })),
    low: e.kcalLow,
    high: e.kcalHigh,
    confidence: e.confidence,
    notes: e.notes,
  });

  const analyze = async (file: File) => {
    let img: Awaited<ReturnType<typeof compressImage>>;
    try {
      img = await compressImage(file);
    } catch {
      setStage({ kind: "error", message: "Couldn't read that image. Try a JPEG or PNG." });
      return;
    }
    setStage({ kind: "analyzing", preview: img.dataUrl });

    // Demo visitors (and owners who haven't unlocked AI) get the sample estimate, no API call.
    if (mode === "demo" || ownerVerified === false) {
      await new Promise((r) => setTimeout(r, 1800));
      setStage(toDraft(img.dataUrl, DEMO_ESTIMATE, true));
      return;
    }
    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: img.base64, mediaType: "image/jpeg", note: note || undefined }),
      });
      const data = (await res.json()) as { estimate?: MealEstimate; error?: string };
      if (!res.ok || !data.estimate) {
        setStage({ kind: "error", preview: img.dataUrl, message: data.error ?? "Estimate failed.", locked: res.status === 401 });
        return;
      }
      setStage(toDraft(img.dataUrl, data.estimate, false));
    } catch {
      setStage({
        kind: "error",
        preview: img.dataUrl,
        message: "You're offline. Photo estimates need a connection; log it manually for now.",
      });
    }
  };

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
      source: "photo",
      confidence: i.confidence,
      kcalRange: [Math.round((s.low * i.kcal) / total), Math.round((s.high * i.kcal) / total)],
    }));
    await db.foodLogs.bulkPut(logs);
    toast({
      message: `Logged ${logs.length} item${logs.length === 1 ? "" : "s"} from your photo.`,
      action: { label: "Undo", onClick: () => db.foodLogs.bulkDelete(logs.map((l) => l.id)) },
    });
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      size="lg"
      title="Snap a meal"
      description={
        stage.kind === "draft"
          ? "Check the guesses, fix anything off, then save."
          : "A vision model estimates each item. You confirm before anything is saved."
      }
      footer={
        stage.kind === "draft" ? (
          <div className="flex gap-2">
            <Button onClick={() => setStage({ kind: "pick" })}>
              <RotateCcw className="size-4" /> Retake
            </Button>
            <Button variant="primary" className="flex-1" disabled={!stage.items.length} onClick={() => save(stage)}>
              Save {Math.round(stage.items.reduce((a, i) => a + i.kcal, 0))} kcal
            </Button>
          </div>
        ) : undefined
      }
    >
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])}
      />
      <input
        ref={libRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && analyze(e.target.files[0])}
      />

      {stage.kind === "pick" && (
        <div className="grid gap-3">
          {(mode === "demo" || ownerVerified === false) && (
            <p className="rounded-[12px] border border-ice/30 bg-ice/10 px-3 py-2.5 text-sm text-ice">
              {mode === "demo"
                ? "Demo mode: you'll get a sample estimate, no photo leaves your device."
                : "AI is locked on this device, so you'll get a sample estimate. "}
              {mode !== "demo" && (
                <Link href="/settings" className="underline underline-offset-2">
                  Unlock in Settings
                </Link>
              )}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="lg" onClick={() => camRef.current?.click()}>
              <Camera className="size-5" /> Take photo
            </Button>
            <Button size="lg" onClick={() => libRef.current?.click()}>
              <ImagePlus className="size-5" /> From library
            </Button>
          </div>
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional hint: 'extra rice', 'fried in coconut oil'…"
            aria-label="Hint for the estimate"
          />
          <p className="text-xs text-fog">Photos are shrunk to 1024 px on your phone before upload and aren&apos;t stored anywhere.</p>
        </div>
      )}

      {stage.kind === "analyzing" && <Scanning preview={stage.preview} />}

      {stage.kind === "error" && (
        <div className="grid gap-3">
          {stage.preview && <img src={stage.preview} alt="Your meal" className="max-h-56 w-full rounded-[14px] object-cover opacity-60" />}
          <p className="text-[15px] text-[#f0a49e]">{stage.message}</p>
          {stage.locked ? (
            <Link href="/settings" className="text-sm text-signal underline underline-offset-2">
              Unlock in Settings → Access
            </Link>
          ) : null}
          <Button onClick={() => setStage({ kind: "pick" })}>Try another photo</Button>
        </div>
      )}

      {stage.kind === "draft" && <Draft stage={stage} onChange={setStage} />}
    </Sheet>
  );
}

function Scanning({ preview }: { preview: string }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-steel">
      <img src={preview} alt="Your meal" className="max-h-72 w-full object-cover" />
      <div className="absolute inset-0 bg-night/40" />
      <motion.div
        className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-signal/35 to-transparent"
        initial={{ top: "-25%" }}
        animate={{ top: ["-25%", "100%"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <p className="absolute inset-x-0 bottom-3 text-center text-sm text-bone">Reading the plate…</p>
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const label = value >= 0.75 ? "High" : value >= 0.5 ? "Medium" : "Low";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs",
        value >= 0.75
          ? "border-verdigris/50 text-verdigris"
          : value >= 0.5
            ? "border-ochre/50 text-ochre"
            : "border-crimson/50 text-[#f0a49e]",
      )}
    >
      {label} confidence
    </span>
  );
}

function Draft({ stage, onChange }: { stage: Extract<Stage, { kind: "draft" }>; onChange: (s: Stage) => void }) {
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
        <img src={stage.preview} alt="Your meal" className="size-24 shrink-0 rounded-[12px] object-cover" />
        <div className="min-w-0">
          <p className="readout text-[40px] font-semibold">{Math.round(total.kcal)}</p>
          <p className="text-sm text-fog">
            likely {stage.low}–{stage.high} kcal (±{pct}%)
          </p>
          <div className="mt-1.5">
            <Confidence value={stage.confidence} />
          </div>
        </div>
      </div>
      {stage.demo && <p className="text-xs text-ice">Sample estimate (demo). Real photos are analysed by Claude once AI is unlocked.</p>}
      {stage.notes && <p className="text-sm text-fog-2">{stage.notes}</p>}
      <MacroLine kcal={total.kcal} p={total.p} c={total.c} f={total.f} />

      <ul className="grid gap-2">
        {stage.items.map((i) => (
          <li key={i.key} className="panel p-3">
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
            <p className="mt-1.5 flex items-center gap-2 text-xs text-fog">
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
                  ["protein", "P", 1],
                  ["carbs", "C", 1],
                  ["fat", "F", 1],
                ] as const
              ).map(([k, label, step]) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-[11px] text-fog">{label}</span>
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
                  className="h-8 flex-1 rounded-full border border-steel text-xs text-fog-2 hover:border-steel-2"
                >
                  ×{m}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
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
        <Plus className="size-4" /> Add an item it missed
      </Button>
    </div>
  );
}
