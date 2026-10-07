"use client";

import { ArrowUp, BookOpen, Camera } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/image";
import { cn } from "@/lib/cn";
import type { Photo } from "./photo-macros";

const IDEAS = ["Kebab", "Nasi goreng", "2 telur ceplok", "Ayam geprek + nasi", "Indomie goreng + telur"];

/**
 * One place to log food: type what you ate and Claude estimates it (Indonesian portions),
 * tap the camera to snap it, or open your saved foods for exact numbers.
 */
export function FoodComposer({
  onDescribe,
  onPhoto,
  onBrowse,
}: {
  onDescribe: (text: string) => void;
  onPhoto: (photo: Photo) => void;
  onBrowse: () => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const ready = text.trim().length > 1;

  const submit = () => {
    if (!ready) return;
    onDescribe(text.trim());
    setText("");
  };

  return (
    <section className="panel p-3">
      <form
        className="flex items-center gap-2"
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
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you eat?"
          aria-label="Describe what you ate"
          enterKeyHint="send"
          className="h-11 min-w-0 flex-1 rounded-full bg-white/[0.07] px-4 text-base outline-none ring-signal/60 placeholder:text-fog/80 focus:ring-1"
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
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => onDescribe(idea)}
            className="h-9 shrink-0 rounded-full bg-white/[0.06] px-3 text-sm text-fog-2 active:scale-[0.97]"
          >
            {idea}
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-xs text-fog">
        Type it and Claude estimates a typical Indonesian portion. Add a photo for a sharper read.
      </p>
    </section>
  );
}
