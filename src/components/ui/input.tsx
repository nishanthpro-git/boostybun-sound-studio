import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-background/70 px-4 py-1 text-base font-semibold text-foreground shadow-[0_2px_0_0_oklch(0_0_0/0.25)_inset] transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-medium placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-electric focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--electric)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
