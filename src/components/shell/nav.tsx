"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Dumbbell, History, PersonStanding, Settings, UtensilsCrossed } from "lucide-react";
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

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-steel bg-night/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-bone" : "text-fog",
                )}
              >
                {active && <span className="absolute top-0 h-[2px] w-8 rounded-b bg-signal" />}
                <Icon className={cn("size-[22px]", active && "text-signal")} strokeWidth={active ? 2.2 : 1.8} />
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
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-steel px-4 py-6 md:flex">
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
                  "flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors",
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
