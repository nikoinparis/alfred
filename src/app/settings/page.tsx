"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronRight, Download, KeyRound, Upload } from "lucide-react";
import { Page, SectionTitle } from "@/components/shell/page";
import { updateSettings, useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Field, NumberField, Segmented, TextInput, Toggle } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { downloadText, exportBackup, exportFoodCsv, exportSetsCsv, importBackup, parseBackup, type Backup } from "@/lib/db/backup";
import { today } from "@/lib/domain/dates";
import type { Unit } from "@/lib/domain/types";
import { isOwnerDevice } from "@/lib/mode";

export default function SettingsPage() {
  const { db } = useApp();
  const settings = useSettings();

  return (
    <Page title="Settings">
      <SectionTitle className="mt-2">Units</SectionTitle>
      <div className="panel p-4">
        <Segmented<Unit>
          label="Weight unit"
          value={settings.unit}
          onChange={(unit) => updateSettings(db, { unit })}
          options={[
            { value: "kg", label: "Kilograms" },
            { value: "lb", label: "Pounds" },
          ]}
        />
        <p className="mt-2.5 text-sm text-fog">
          Switch any time. Every set keeps the unit you logged it in, so nothing drifts from rounding.
        </p>
      </div>

      <SectionTitle>Training</SectionTitle>
      <div className="panel divide-steel">
        <LinkRow href="/settings/templates" label="Workout templates" detail="Exercises, sets, reps and weights per day" />
        <LinkRow href="/settings/exercises" label="Exercise library" detail="Muscles each exercise trains" />
        <LinkRow href="/body?targets=1" label="Weekly set targets" detail="Per muscle group" />
        <div className="grid grid-cols-2 gap-3 p-4">
          <Field label="Rest, compound (s)">
            <NumberField label="Compound rest seconds" value={settings.restSeconds} step={15} min={15} max={600} onChange={(v) => v && updateSettings(db, { restSeconds: v })} />
          </Field>
          <Field label="Rest, isolation (s)">
            <NumberField label="Isolation rest seconds" value={settings.restSecondsIsolation} step={15} min={15} max={600} onChange={(v) => v && updateSettings(db, { restSecondsIsolation: v })} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-[15px]">Vibrate when rest ends</p>
            <p className="text-sm text-fog">Works on Android. iOS web apps can&apos;t vibrate, so you get a sound instead.</p>
          </div>
          <Toggle label="Vibrate when rest ends" checked={settings.haptics} onChange={(haptics) => updateSettings(db, { haptics })} />
        </div>
      </div>

      <SectionTitle>Nutrition</SectionTitle>
      <div className="panel divide-steel">
        <LinkRow href="/fuel/goals" label="Goal & targets" detail="Phase, stats, calories and macros" />
        <LinkRow href="/fuel/foods" label="Foods & saved meals" detail="Quick-add library" />
      </div>

      <DataSection />
      <AccessSection />

      <p className="mt-10 text-center text-xs text-fog">
        Alfred · build {process.env.NEXT_PUBLIC_BUILD_ID?.slice(0, 7)} ·{" "}
        <Link href="/about" className="underline underline-offset-2">
          About
        </Link>
      </p>
    </Page>
  );
}

function LinkRow({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-gunmetal-2/50">
      <div className="min-w-0 flex-1">
        <p className="text-[15px]">{label}</p>
        <p className="truncate text-sm text-fog">{detail}</p>
      </div>
      <ChevronRight className="size-4 text-fog" />
    </Link>
  );
}

function DataSection() {
  const { db, mode } = useApp();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const stamp = today();

  const onFile = async (file: File) => {
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      toast({ message: (e as Error).message, tone: "danger" });
    }
  };

  return (
    <>
      <SectionTitle>Your data</SectionTitle>
      <div className="panel p-4">
        <p className="text-sm text-fog">
          Everything lives on this device. iOS can clear website storage for apps you haven&apos;t opened in a while, so export a backup now and then.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            variant="primary"
            onClick={async () => {
              downloadText(`alfred-backup-${stamp}.json`, JSON.stringify(await exportBackup(db)));
              toast({ message: "Backup exported." });
            }}
          >
            <Download className="size-4" /> Export backup (JSON)
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Import backup
          </Button>
          <Button variant="ghost" onClick={async () => downloadText(`alfred-sets-${stamp}.csv`, await exportSetsCsv(db), "text/csv")}>
            Sets as CSV
          </Button>
          <Button variant="ghost" onClick={async () => downloadText(`alfred-food-${stamp}.csv`, await exportFoodCsv(db), "text/csv")}>
            Food log as CSV
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Replace your data?"
        description={pending ? `Backup from ${new Date(pending.exportedAt).toLocaleString()}.` : undefined}
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setPending(null)}>
              Keep current data
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={async () => {
                if (!pending) return;
                await importBackup(db, pending);
                setPending(null);
                toast({ message: "Backup imported." });
              }}
            >
              Replace with backup
            </Button>
          </div>
        }
      >
        <p className="text-sm text-fog-2">
          Importing replaces everything currently in {mode === "demo" ? "the demo" : "Alfred on this device"}: workouts, templates, food and bodyweight.
        </p>
      </Sheet>
    </>
  );
}

function AccessSection() {
  const { mode, switchMode, resetDemo, ownerVerified, refreshOwner } = useApp();
  const toast = useToast();
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase: pass }),
      });
      const data = (await res.json()) as { owner?: boolean; error?: string };
      if (res.status === 503) {
        // No passphrase configured (local dev): allow local-only owner mode.
        await switchMode("owner");
        toast({ message: "Switched to your data. AI photo logging needs OWNER_PASSPHRASE on the server." });
      } else if (!res.ok) {
        setError(data.error ?? "Couldn't unlock.");
      } else {
        await refreshOwner();
        if (mode !== "owner") await switchMode("owner");
        toast({ message: "Unlocked. Welcome back.", tone: "signal" });
        setPass("");
      }
    } catch {
      setError("You're offline. Connect once to unlock this device.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Access</SectionTitle>
      <div className="panel p-4">
        {mode === "demo" ? (
          <p className="text-sm text-fog-2">
            You&apos;re looking at a demo athlete. Nothing you change here is saved past this visit, and nothing personal is ever shown.
          </p>
        ) : (
          <p className="text-sm text-fog-2">
            Your own data, stored only on this device.{" "}
            {ownerVerified ? "AI photo logging is unlocked." : "Enter your passphrase to unlock AI photo logging."}
          </p>
        )}
        {(mode === "demo" || !ownerVerified) && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (pass) unlock();
            }}
          >
            <TextInput
              type="password"
              autoComplete="current-password"
              placeholder="Owner passphrase"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              aria-label="Owner passphrase"
            />
            <Button type="submit" variant="primary" disabled={!pass || busy}>
              <KeyRound className="size-4" /> Unlock
            </Button>
          </form>
        )}
        {error && <p className="mt-2 text-sm text-[#f0a49e]">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {mode === "owner" ? (
            <Button variant="ghost" size="sm" onClick={() => switchMode("demo")}>
              View the demo
            </Button>
          ) : (
            <>
              {isOwnerDevice() && (
                <Button size="sm" onClick={() => switchMode("owner")}>
                  Back to my data
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => resetDemo().then(() => toast({ message: "Demo reset." }))}>
                Reset demo data
              </Button>
            </>
          )}
          {ownerVerified && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await fetch("/api/owner", { method: "DELETE" });
                await refreshOwner();
                toast({ message: "AI access locked on this device." });
              }}
            >
              Lock AI access
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
