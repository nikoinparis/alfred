"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChevronLeft, Settings } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useApp } from "@/components/providers/app-provider";

interface PageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Back navigation shown at the leading edge of the nav bar. */
  back?: { label: string; href?: string; onClick?: () => void };
  children: ReactNode;
  className?: string;
  /** Wider max width for dashboards on desktop. */
  wide?: boolean;
}

/**
 * Page chrome modelled on the HIG large-title pattern: a big title scrolls with the content,
 * and a compact title fades into a translucent nav bar once it scrolls away.
 */
export function Page({ title, subtitle, actions, back, children, className, wide }: PageProps) {
  const { mode } = useApp();
  const inSettings = usePathname().startsWith("/settings");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting), { rootMargin: "-56px 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const width = wide ? "max-w-6xl" : "max-w-3xl";

  return (
    <div className="relative z-[1] min-w-0 flex-1">
      <header className="sticky top-0 z-30 md:hidden" style={{ paddingTop: "var(--safe-top)" }}>
        <div
          className={cn(
            "material absolute inset-0 border-b border-separator transition-opacity duration-200",
            collapsed ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />
        <div className={cn("relative mx-auto grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 px-2", width)}>
          <div className="flex min-w-0 items-center">
            {back && (
              <BackLink back={back} className="flex h-11 min-w-0 items-center pr-2 text-base text-signal active:opacity-60">
                <ChevronLeft className="size-7 shrink-0" strokeWidth={2.2} />
                <span className="-ml-0.5 truncate">{back.label}</span>
              </BackLink>
            )}
          </div>
          <p
            className={cn(
              "max-w-[52vw] truncate text-base font-semibold transition-opacity duration-200",
              collapsed ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={!collapsed}
          >
            {title}
          </p>
          <div className="flex items-center justify-end gap-1">
            {actions}
            {!inSettings && (
              <Link
                href="/settings"
                className="grid size-11 place-items-center rounded-full text-signal active:opacity-60"
                aria-label="Settings"
              >
                <Settings className="size-[22px]" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
        className={cn("mx-auto px-4 md:px-8 md:pt-8", width, className)}
        style={{ paddingBottom: "calc(var(--tabbar-h) + var(--safe-bottom) + 24px)" }}
      >
        <div className="mb-4 flex items-end gap-3 pt-1">
          <div className="min-w-0 flex-1">
            {back && (
              <BackLink back={back} className="mb-1 hidden items-center gap-0.5 text-sm text-signal hover:opacity-80 md:inline-flex">
                <ChevronLeft className="size-4" /> {back.label}
              </BackLink>
            )}
            <h1 ref={titleRef} className="text-3xl font-bold tracking-[-0.02em]">
              {title}
            </h1>
            {subtitle && <p className="mt-0.5 text-sm text-fog">{subtitle}</p>}
          </div>
          {mode === "demo" && (
            <Link href="/about" className="mb-1 rounded-full bg-ice/12 px-2.5 py-1 text-xs font-semibold text-ice">
              Demo
            </Link>
          )}
          <div className="hidden items-center gap-1 md:flex">{actions}</div>
        </div>
        {children}
      </motion.main>
    </div>
  );
}

function BackLink({ back, className, children }: { back: NonNullable<PageProps["back"]>; className: string; children: ReactNode }) {
  if (back.href) {
    return (
      <Link href={back.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={back.onClick} className={className}>
      {children}
    </button>
  );
}

/** Grouped-list section header, aligned with the row text inside the list below it. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 mt-8 flex items-end justify-between gap-3 px-4", className)}>
      <h2 className="text-sm font-semibold text-fog">{children}</h2>
      {action && <div className="text-sm">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-fog">{icon}</div>}
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-fog">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
