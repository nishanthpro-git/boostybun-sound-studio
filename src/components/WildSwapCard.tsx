import { cn } from "@/lib/utils";
import { WILD_SWAP_URL } from "@/lib/brand";

/** The uploaded Wild Swap card art. Clickable when onClick is given. */
export function WildSwapCard({ className, onClick, disabled, label = "Wild Swap", count }: {
  className?: string; onClick?: () => void; disabled?: boolean; label?: string; count?: number;
}) {
  const img = <img src={WILD_SWAP_URL} alt={onClick ? "" : label} draggable={false} className="wild-card w-full" />;
  const badge = count !== undefined && (
    <span className="absolute -top-1.5 -right-1.5 grid min-w-6 place-items-center rounded-full bg-gradient-blue px-1.5 font-display text-sm font-bold text-accent-foreground shadow-blue-glow">{count}</span>
  );
  if (!onClick) return <span className={cn("relative inline-block shrink-0", className)}>{img}{badge}</span>;
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={cn("wild-card-btn relative inline-block shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background", className)}>
      {img}{badge}
    </button>
  );
}
