"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/components/providers/app-provider";
import { Emblem } from "./logo";

interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Wider max width for dashboards on desktop. */
  wide?: boolean;
}

export function Page({ title, subtitle, actions, children, className, wide }: PageProps) {
  const { mode } = useApp();
  const inSettings = usePathname().startsWith("/settings");
  return (
    <div className="relative z-[1] min-w-0 flex-1">
      <header
        className="sticky top-0 z-30 border-b border-transparent bg-night/80 backdrop-blur-xl md:static md:bg-transparent md:backdrop-blur-none"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className={cn("mx-auto flex items-end gap-3 px-4 pb-3 pt-3 md:px-8 md:pt-8", wide ? "max-w-6xl" : "max-w-3xl")}>
          <Link href="/" className="mb-1 md:hidden" aria-label="Alfred home">
            <Emblem className="size-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[28px] font-semibold leading-none tracking-tight md:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1.5 truncate text-sm text-fog">{subtitle}</p>}
          </div>
          {mode === "demo" && (
            <Link href="/about" className="mb-0.5 rounded-full border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs font-medium text-ice">
              Demo
            </Link>
          )}
          {actions}
          {!inSettings && (
            <Link
              href="/settings"
              className="-mr-2 grid size-10 place-items-center rounded-full text-fog hover:text-bone md:hidden"
              aria-label="Settings"
            >
              <Settings className="size-5" />
            </Link>
          )}
        </div>
      </header>
      <main
        className={cn("mx-auto px-4 pt-2 md:px-8", wide ? "max-w-6xl" : "max-w-3xl", className)}
        style={{ paddingBottom: "calc(var(--tabbar-h) + var(--safe-bottom) + 28px)" }}
      >
        {children}
      </main>
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2.5 mt-7 flex items-end justify-between gap-3", className)}>
      <h2 className="font-display text-lg font-semibold tracking-wide text-fog-2">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-steel-2">{icon}</div>}
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-fog">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
