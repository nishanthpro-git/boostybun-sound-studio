import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Coin } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoomState, RoundRewards } from "@/lib/game";

const COUNTDOWN = 5;

export function RoundReward({ rewards, state, meId, onDone, claim }: { rewards: RoundRewards; state: RoomState; meId: string; onDone: () => void; claim?: React.ReactNode }) {
  const [step, setStep] = useState(0);
  const [left, setLeft] = useState(COUNTDOWN);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) setStep(1);
    const start = performance.now();
    const interval = setInterval(() => setStep(Math.min(1, (performance.now() - start) / 1800)), 40);
    return () => clearInterval(interval);
  }, [rewards.round]);
  useEffect(() => {
    setLeft(COUNTDOWN);
    const start = Date.now();
    const t = setInterval(() => {
      const remain = COUNTDOWN - Math.floor((Date.now() - start) / 1000);
      setLeft(Math.max(0, remain));
      if (remain <= 0) { clearInterval(t); onDone(); }
    }, 200);
    return () => clearInterval(t);
  }, [rewards.round, onDone]);
  return <section className="panel screen-in space-y-4 p-5 sm:p-6" aria-live="polite">
    <div className="flex flex-col items-center gap-2 text-center">
      <Coin className="coin-spin size-16 drop-shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_60%,transparent)]" />
      <p className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Round {rewards.round} complete</p>
      <h2 className="text-3xl font-bold">BoostyBuns earned</h2>
    </div>
    <ul className="space-y-2">
      {rewards.entries.map((e, i) => {
        const player = state.players.find(p => p.id === e.playerId);
        if (!player) return null;
        const mine = e.playerId === meId;
        return <li key={e.playerId} style={{ animationDelay: `${i * 0.07}s` }} className={cn("reward-pop flex items-center gap-3 rounded-2xl border p-3 sm:p-4", mine ? "border-electric bg-electric/10 shadow-[0_0_24px_-10px_var(--electric)]" : "border-border bg-background/40")}>
          <Avatar src={player.avatar} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{player.name} {mine && <span className="text-electric-glow">(you)</span>}</p>
            {e.bonus > 0 && <p className="text-sm font-bold text-gold">🏆 +2 Victory bonus</p>}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-3xl font-bold text-primary tabular-nums">+{Math.round((e.earned + e.bonus) * step)}<Coin className="size-8" /></span>
        </li>;
      })}
    </ul>
    {claim}
    <div className="flex flex-col items-center gap-2 pt-1">
      <p className="text-sm text-muted-foreground">Back to lobby in <span className="font-display font-bold text-foreground">{left}s</span></p>
      <Button variant="secondary" size="xl" className="w-full font-display" onClick={onDone}>Return to lobby</Button>
    </div>
  </section>;
}
