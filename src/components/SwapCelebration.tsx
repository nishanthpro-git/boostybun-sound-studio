import { useEffect, useMemo, useState } from "react";
import { WildSwapCard } from "@/components/WildSwapCard";
import { cn } from "@/lib/utils";

const COLORS = ["bg-primary", "bg-electric", "bg-gold", "bg-success", "bg-electric-glow"];

/** Shown only after a successful Wild Swap claim; dismisses itself after a short celebration. */
export function SwapCelebration({ onClose }: { onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), 3200);
    const b = setTimeout(onClose, 3550);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onClose]);
  const confetti = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 1.2, fall: 2.2 + Math.random() * 1.6, spin: 360 + Math.random() * 540,
    color: COLORS[i % COLORS.length], round: i % 3 === 0, size: 6 + Math.random() * 7,
  })), []);
  const close = () => { setLeaving(true); setTimeout(onClose, 300); };
  return <div role="dialog" aria-modal="true" aria-label="Wild Swap unlocked" onClick={close}
    className={cn("swap-fade fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/75 p-6 backdrop-blur-sm", leaving && "wild-out")}>
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {confetti.map((c, i) => <span key={i} className={cn("confetti-piece absolute top-0", c.color, c.round ? "rounded-full" : "rounded-sm")}
        style={{ left: `${c.left}%`, width: c.size, height: c.round ? c.size : c.size * 1.6, ["--delay" as string]: `${c.delay}s`, ["--fall" as string]: `${c.fall}s`, ["--spin" as string]: `${c.spin}deg` }} />)}
    </div>
    <div className="relative flex flex-col items-center text-center">
      <div aria-hidden className="wild-glow absolute top-[38%] size-72 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--violet)_70%,transparent)_0%,transparent_70%)] blur-xl sm:size-96" />
      <p className="reward-pop relative text-xs font-extrabold tracking-[0.3em] text-gold uppercase">Congratulations!</p>
      <WildSwapCard className="wild-enter relative my-4 w-40 sm:w-52" />
      <h2 className="reward-pop relative font-display text-4xl leading-none font-bold text-primary sm:text-5xl" style={{ animationDelay: "0.35s" }}>WILD SWAP<br />UNLOCKED!</h2>
      <p className="reward-pop relative mt-3 max-w-xs font-bold" style={{ animationDelay: "0.5s" }}>You claimed a Wild Swap power. Use it to swap the card you just received!</p>
    </div>
  </div>;
}
