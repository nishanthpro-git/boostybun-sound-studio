import { cn } from "@/lib/utils";
import { COIN_URL, LOGO_URL } from "@/lib/brand";

/** "Boosty" + "Bun" on one line, same size and weight; Bun stays vibrant orange. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("wordmark inline-flex items-baseline font-display font-bold leading-none tracking-tight whitespace-nowrap", className)}>
      <span className="text-boosty">Boosty</span>
      <span className="text-bun">Bun</span>
    </span>
  );
}

export function LogoBadge({ className }: { className?: string }) {
  return <img src={LOGO_URL} alt="BoostyBun bunny" draggable={false} className={cn("select-none drop-shadow-[0_8px_24px_color-mix(in_oklch,var(--electric)_45%,transparent)]", className)} />;
}

/** The BoostyBuns currency badge. */
export function Coin({ className, label }: { className?: string; label?: string }) {
  return <img src={COIN_URL} alt={label ?? ""} aria-hidden={label ? undefined : true} draggable={false} className={cn("inline-block size-5 shrink-0 select-none align-[-0.2em] drop-shadow-[0_2px_4px_oklch(0_0_0/0.5)]", className)} />;
}

/** Amount of BoostyBuns with the coin badge. */
export function Buns({ amount, className, coinClassName, prefix = "" }: { amount: number | string; className?: string; coinClassName?: string; prefix?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-display font-bold tabular-nums", className)}>
      <Coin className={coinClassName} />
      {prefix}{amount}
    </span>
  );
}
