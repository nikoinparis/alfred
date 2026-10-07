"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Apple, ChevronRight, Download, Dumbbell, Gauge, KeyRound, ListChecks, Target, Upload } from "lucide-react";
import { Page, SectionTitle } from "@/components/shell/page";
import { updateSettings, useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Segmented, TextInput } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { backupNow, exportFoodCsv, exportSetsCsv, importBackup, parseBackup, shareOrSave, type Backup } from "@/lib/db/backup";
import { formatDistanceToNowStrict } from "date-fns";
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
      </div>
      <p className="mt-2 px-4 text-xs text-fog">
        Switch any time. Every set keeps the unit you logged it in, so nothing drifts from rounding.
      </p>

      <SectionTitle>Training</SectionTitle>
      <ul className="panel divide-steel">
        <LinkRow href="/settings/templates" icon={<ListChecks />} tint="bg-signal/20 text-signal" label="Workout templates" />
        <LinkRow href="/settings/exercises" icon={<Dumbbell />} tint="bg-ice/20 text-ice" label="Exercise library" />
        <LinkRow href="/body?targets=1" icon={<Target />} tint="bg-verdigris/20 text-verdigris" label="Weekly set targets" />
      </ul>

      <SectionTitle>Nutrition</SectionTitle>
      <ul className="panel divide-steel">
        <LinkRow href="/fuel/goals" icon={<Gauge />} tint="bg-ochre/20 text-ochre" label="Goal & targets" />
        <LinkRow href="/fuel/foods" icon={<Apple />} tint="bg-crimson/20 text-[#f3a59e]" label="Foods & saved meals" />
      </ul>

      <DataSection />
      <AccessSection />

      <p className="mt-10 text-center text-xs text-fog">
        Alfred · build {process.env.NEXT_PUBLIC_BUILD_ID?.slice(0, 7)} ·{" "}
        <Link href="/about" className="text-signal">
          About
        </Link>
      </p>
    </Page>
  );
}

function LinkRow({ href, label, icon, tint }: { href: string; label: string; icon: React.ReactNode; tint: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
        <span className={`grid size-[30px] shrink-0 place-items-center rounded-[8px] [&_svg]:size-[18px] ${tint}`}>{icon}</span>
        <span className="min-w-0 flex-1 text-base">{label}</span>
        <ChevronRight className="size-5 text-fog/70" />
      </Link>
    </li>
  );
}

function DataSection() {
  const { db, mode } = useApp();
  const settings = useSettings();
  const lastBackup = settings.lastBackupAt
    ? `Last backup ${formatDistanceToNowStrict(settings.lastBackupAt, { addSuffix: true })}`
    : "No backup yet";
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
        <p className="text-base">{lastBackup}</p>
        <p className="mt-1 text-sm text-fog">
          Everything lives on this device, and iOS can clear storage for web apps you haven&apos;t opened in a while. Alfred reminds you
          weekly; on iPhone choose <span className="text-fog-2">Save to Files</span> to keep the backup in iCloud Drive.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            variant="primary"
            onClick={async () => {
              const r = await backupNow(db, stamp);
              if (r !== "cancelled")
                toast({ message: r === "shared" ? "Backup ready. Choose Save to Files to keep it in iCloud." : "Backup downloaded." });
            }}
          >
            <Download className="size-4" /> Back up now
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Import backup
          </Button>
          <Button variant="ghost" onClick={async () => shareOrSave(`alfred-sets-${stamp}.csv`, await exportSetsCsv(db), "text/csv")}>
            Sets as CSV
          </Button>
          <Button variant="ghost" onClick={async () => shareOrSave(`alfred-food-${stamp}.csv`, await exportFoodCsv(db), "text/csv")}>
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
          Importing replaces everything currently in {mode === "demo" ? "the demo" : "Alfred on this device"}: workouts, templates, food and
          bodyweight.
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
