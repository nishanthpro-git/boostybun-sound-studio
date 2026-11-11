import { useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLORS = ["bg-primary", "bg-primary-glow", "bg-gold", "bg-foreground", "bg-electric-glow"];
type Burst = { id: number; parts: { dx: number; dy: number; size: number; color: string; delay: number }[] };

/**
 * The BOOST button plus a burst layer that outlives it, so particles keep flying
 * after the press swaps the button for the waiting state. Presentation only.
 */
export function BoostStage({ canBoost, disabled, onBoost, waiting }: { canBoost: boolean; disabled: boolean; onBoost: () => void; waiting: React.ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);
  const burst = () => {
    const id = ++nextId.current;
    const parts = Array.from({ length: 22 }, (_, i) => {
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 110 + Math.random() * 90;
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, size: 6 + Math.random() * 10, color: COLORS[i % COLORS.length], delay: Math.random() * 0.08 };
    });
    setBursts((b) => [...b, { id, parts }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1000);
  };
  return (
    <div className="relative grid min-h-64 w-full place-items-center sm:min-h-72">
      {canBoost ? (
        <div className="relative grid place-items-center">
          <span aria-hidden className="boost-halo pointer-events-none absolute -inset-16 rounded-full" />
          <span aria-hidden className="boost-ring pointer-events-none absolute inset-0 rounded-full" />
          <span aria-hidden className="boost-ring pointer-events-none absolute inset-0 rounded-full [animation-delay:0.9s]" />
          <Button variant="boost" size="huge" disabled={disabled} onClick={() => { burst(); onBoost(); }}>BOOST!</Button>
        </div>
      ) : (
        <div className="screen-in">{waiting}</div>
      )}
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
        {bursts.map((b) => (
          <div key={b.id}>
            <span className="shockwave absolute top-0 left-0 size-48 rounded-full border-4 border-primary-glow" />
            {b.parts.map((p, i) => (
              <span
                key={i}
                className={cn("particle absolute top-0 left-0 rounded-full", p.color)}
                style={{ width: p.size, height: p.size, animationDelay: `${p.delay}s`, "--dx": `${p.dx}px`, "--dy": `${p.dy}px` } as CSSProperties}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
