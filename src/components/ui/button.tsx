import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Button styles follow the HIG hierarchy: one filled (prominent) action per view,
 * tinted/gray for secondary actions, plain text for tertiary. Every size keeps a ≥44 pt hit area.
 */
export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.97] active:opacity-80 disabled:pointer-events-none disabled:opacity-35 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
  {
    variants: {
      variant: {
        primary: "bg-signal text-signal-ink",
        secondary: "bg-white/[0.08] text-bone hover:bg-white/[0.11]",
        tinted: "bg-signal-soft text-signal hover:bg-signal/20",
        ghost: "text-signal hover:bg-white/[0.05]",
        danger: "bg-crimson/15 text-[#f3a59e] hover:bg-crimson/22",
      },
      size: {
        sm: "h-9 rounded-full px-3.5 text-sm",
        md: "h-11 rounded-full px-5 text-base",
        lg: "h-[52px] rounded-full px-6 text-base",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
