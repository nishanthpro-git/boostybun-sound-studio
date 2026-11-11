import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold cursor-pointer transition-[transform,box-shadow,background-color,border-color,filter,color] duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Electric blue: selection and supporting interactions
        default: "bg-gradient-blue text-accent-foreground shadow-[0_1px_0_0_oklch(1_0_0/0.3)_inset,0_3px_0_0_oklch(0.42_0.18_262)] hover:brightness-110 active:translate-y-0.5",
        destructive: "bg-[image:var(--gradient-red)] text-destructive-foreground shadow-[0_1px_0_0_oklch(1_0_0/0.3)_inset,0_3px_0_0_oklch(0.42_0.16_22)] hover:brightness-110 active:translate-y-0.5",
        outline: "border border-border bg-surface/80 text-foreground shadow-[0_1px_0_0_oklch(1_0_0/0.05)_inset] hover:border-electric hover:bg-surface-2 active:translate-y-px",
        secondary: "btn-navy",
        ghost: "text-foreground hover:bg-surface-2/80 active:bg-surface-2",
        link: "text-electric-glow underline-offset-4 hover:underline",
        // Vibrant orange: primary actions
        game: "btn-orange font-display text-base tracking-wide",
        victory: "btn-victory font-display text-base tracking-wide",
        boost: "boost-btn font-display text-5xl font-bold rounded-full animate-boost",
        finale: "btn-navy font-display text-base tracking-wide border-gold/50 text-gold hover:border-gold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
        xl: "h-14 px-8 text-lg",
        huge: "size-48 sm:size-56",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
