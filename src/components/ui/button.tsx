import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,transform,border-color] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-signal text-signal-ink hover:bg-[#ebbd5c]",
        secondary: "border border-steel-2 bg-gunmetal-2 text-bone hover:border-fog/50",
        ghost: "text-fog-2 hover:bg-gunmetal-2 hover:text-bone",
        danger: "border border-crimson/40 bg-crimson/10 text-[#f0a49e] hover:bg-crimson/20",
      },
      size: {
        sm: "h-9 rounded-[10px] px-3 text-sm",
        md: "h-11 rounded-[12px] px-4 text-[15px]",
        lg: "h-14 rounded-[14px] px-6 text-base",
        icon: "size-11 rounded-[12px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
