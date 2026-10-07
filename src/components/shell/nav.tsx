"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Dumbbell, History, PersonStanding, Settings, UtensilsCrossed } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useApp } from "@/components/providers/app-provider";
import { Wordmark } from "./logo";

const TABS = [
  { href: "/", label: "Today", icon: Dumbbell },
  { href: "/plan", label: "Plan", icon: CalendarRange },
  { href: "/body", label: "Body", icon: PersonStanding },
  { href: "/fuel", label: "Fuel", icon: UtensilsCrossed },
  { href: "/history", label: "History", icon: History },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Floating tab bar on translucent material; the selection pill glides between tabs. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 md:hidden"
      style={{ paddingBottom: "max(10px, calc(var(--safe-bottom) - 6px))" }}
    >
      <ul className="material pointer-events-auto mx-auto grid h-[62px] max-w-md grid-cols-5 rounded-[31px] p-1 shadow-[0_12px_40px_-12px_rgb(0_0_0_/_0.9),inset_0_0.5px_0_rgb(255_255_255_/_0.12)] ring-[0.5px] ring-white/10">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="relative">
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[27px] bg-white/[0.09]"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold tracking-normal transition-colors active:scale-95",
                  active ? "text-signal" : "text-fog-2",
                )}
              >
                <Icon className="size-[23px]" strokeWidth={active ? 2.1 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideRail() {
  const pathname = usePathname();
  const { mode } = useApp();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-separator px-4 py-6 md:flex">
      <Link href="/" className="px-2">
        <Wordmark />
      </Link>
      <ul className="mt-8 space-y-1">
        {[...TABS, { href: "/settings", label: "Settings", icon: Settings }].map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[10px] px-3 text-base transition-colors",
                  active ? "bg-gunmetal-2 text-bone shadow-[inset_2px_0_0_var(--signal)]" : "text-fog hover:text-bone",
                )}
              >
                <Icon className={cn("size-5", active && "text-signal")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto px-2 text-xs text-fog">
        {mode === "demo" ? (
          <Link href="/about" className="hover:text-bone">
            Demo data. About this project
          </Link>
        ) : (
          "Your data stays on this device."
        )}
      </div>
    </aside>
  );
}
