"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { HardDriveDownload } from "lucide-react";
import { useState } from "react";
import { updateSettings, useApp, useSettings } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { backupDue, backupNow } from "@/lib/db/backup";
import { today } from "@/lib/domain/dates";

/** Weekly nudge to export a backup, because iOS may evict storage for idle web apps. Owner mode only. */
export function BackupNudge() {
  const { db, mode } = useApp();
  const settings = useSettings();
  const toast = useToast();
  const sessions = useLiveQuery(() => db.sessions.count(), [db]) ?? 0;
  const [now] = useState(() => Date.now());
  const show =
    mode === "owner" && backupDue({ lastBackupAt: settings.lastBackupAt, snoozeUntil: settings.backupSnoozeUntil, sessions, now });
  const days = settings.lastBackupAt ? Math.floor((now - settings.lastBackupAt) / 86_400_000) : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="panel mb-4 flex items-center gap-3 p-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-ice/15 text-ice">
              <HardDriveDownload className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">Back up your log</p>
              <p className="text-sm text-fog">{days === null ? "You haven't saved a copy yet." : `Last backup ${days} days ago.`}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  const r = await backupNow(db, today());
                  if (r === "shared") toast({ message: "Choose Save to Files to keep it in iCloud." });
                }}
              >
                Back up
              </Button>
              <button
                type="button"
                className="h-8 px-2 text-xs text-fog"
                onClick={() => updateSettings(db, { backupSnoozeUntil: Date.now() + 2 * 86_400_000 })}
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
