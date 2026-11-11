import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { ReactionBar } from "@/components/LiveSocial";
import { Buns, LogoBadge, Wordmark } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { CELEBRATION_MS, type Action, type RoomState } from "@/lib/game";

const CONFETTI_COLORS = ["bg-primary", "bg-electric", "bg-gold", "bg-primary-glow", "bg-electric-glow", "bg-foreground"];

/** Short synthesized fanfare; silently skipped when the browser blocks audio. */
function playFanfare() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime + 0.05;
    const note = (freq: number, start: number, dur: number, type: OscillatorType = "triangle", vol = 0.18) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + start);
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(vol, t0 + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.05);
    };
    // Ta-da-da-DAAA + sparkles
    [[523.25, 0, 0.18], [659.25, 0.16, 0.18], [783.99, 0.32, 0.18], [1046.5, 0.5, 0.9]].forEach(([f, s, d]) => note(f, s, d));
    [[392, 0.5, 0.9], [659.25, 0.5, 0.9]].forEach(([f, s, d]) => note(f, s, d, "sine", 0.1));
    for (let i = 0; i < 10; i++) note(1400 + Math.random() * 1600, 1.2 + i * 0.12, 0.25, "sine", 0.05);
    setTimeout(() => void ctx.close().catch(() => {}), 4000);
  } catch {
    /* audio unavailable */
  }
}

export function FinalCelebration({ state, meId, serverNow, send, onLeave }: {
  state: RoomState;
  meId: string;
  serverNow: number;
  send: (a: Action) => Promise<boolean | undefined>;
  onLeave: () => void;
}) {
  const final = state.final;
  const remaining = final ? Math.max(0, Math.ceil((final.endedAt + CELEBRATION_MS - serverNow) / 1000)) : 0;
  const celebrating = remaining > 0;
  const [busy, setBusy] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    if (!final || played.current) return;
    played.current = true;
    if (serverNow - final.endedAt < CELEBRATION_MS) playFanfare();
  }, [final, serverNow]);

  const confetti = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3,
      fall: 2.6 + Math.random() * 2.4,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: Math.random() > 0.7,
    })),
    [],
  );

  if (!final) return null;
  const winners = final.winners.map((id) => {
    const live = state.players.find((p) => p.id === id);
    const snap = final.standings.find((s) => s.playerId === id);
    return { id, name: live?.name ?? snap?.name ?? "Someone", avatar: live?.avatar, score: snap?.score ?? 0 };
  });
  const joint = winners.length > 1;
  const iWon = final.winners.includes(meId);

  const newGame = async () => {
    if (busy) return;
    setBusy(true);
    try { await send({ type: "newGame" }); } finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Final results" className="swap-fade fixed inset-0 z-50 flex flex-col items-center overflow-x-hidden overflow-y-auto bg-background/95 p-4 backdrop-blur-sm">
      <div aria-hidden className="rays-spin pointer-events-none absolute top-1/2 left-1/2 size-[160vmax] -translate-x-1/2 -translate-y-1/2 bg-[repeating-conic-gradient(var(--color-electric)_0deg_10deg,transparent_10deg_30deg)] opacity-[0.08]" />
      {celebrating && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {confetti.map((c) => (
            <span
              key={c.id}
              className={cn("confetti-piece absolute top-0", c.color, c.round ? "rounded-full" : "rounded-sm")}
              style={{ left: `${c.left}%`, width: c.w, height: c.round ? c.w : c.h, "--delay": `${c.delay}s`, "--fall": `${c.fall}s`, "--spin": `${c.spin}deg` } as CSSProperties}
            />
          ))}
        </div>
      )}

      <div className="panel swap-burst relative my-auto w-full max-w-md space-y-4 border-2 border-primary/70 p-5 text-center shadow-[var(--shadow-panel),0_0_70px_-16px_var(--primary)] sm:space-y-5 sm:p-6">
        <div className="flex items-center justify-center gap-2"><LogoBadge className="size-10" /><Wordmark className="text-2xl" /></div>
        <p className="font-display text-sm tracking-widest text-muted-foreground uppercase">Game over</p>
        <h2 className="text-3xl font-bold text-primary sm:text-4xl">{joint ? (iWon ? "You're a joint winner! 🎉" : "Joint winners! 🎉") : iWon ? "You won! 🎉" : "Congratulations! 🎉"}</h2>

        <div className={cn("flex flex-wrap items-end justify-center", joint ? "gap-x-4 gap-y-3" : "gap-5")}>
          {winners.map((w, i) => (
            <div key={w.id} className={cn("winner-bounce flex flex-col items-center gap-1", joint && "w-24")} style={{ animationDelay: `${i * 0.15}s` }}>
              <span className={cn("crown-wiggle", joint ? "text-2xl" : "text-4xl")} aria-hidden>👑</span>
              <Avatar src={w.avatar} className={cn("glow-active", joint ? "size-16 text-4xl" : "size-28 text-6xl")} />
              <span className={cn("mt-1 max-w-full truncate font-display", joint ? "text-base" : "text-xl")}>{w.id === meId ? "You" : w.name}</span>
              <span className={cn("inline-flex items-center rounded-full bg-gradient-orange px-3 py-0.5 text-primary-foreground shadow-[var(--shadow-orange)]", joint && "px-2 text-xs")}><Buns amount={w.score} coinClassName={joint ? "size-4" : "size-5"} />{joint ? "" : <span className="ml-1 font-display">BoostyBuns</span>}</span>
            </div>
          ))}
        </div>
        {joint && <p className="-mt-1 flex items-center justify-center gap-1 text-sm font-bold text-muted-foreground">Tied at <Buns amount={winners[0]?.score ?? 0} className="text-foreground" coinClassName="size-4" /> BoostyBuns each</p>}

        {final.standings.length > 1 && (
          <ol className="mx-auto max-w-xs space-y-1 text-left text-sm">
            {final.standings.map((s, i) => (
              <li key={s.playerId} className={cn("flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5", final.winners.includes(s.playerId) ? "border-primary/60 bg-primary/10 font-bold" : "border-border bg-background/40")}>
                <span className="truncate">#{i + 1} {s.name}</span><Buns amount={s.score} className="shrink-0" coinClassName="size-4" />
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Send some love 👇</p>
          <ReactionBar send={send} className="panel-inset p-1" />
        </div>

        {celebrating ? (
          <p className="font-display text-muted-foreground" aria-live="polite">Celebrating… {remaining}s</p>
        ) : (
          <div className="swap-fade grid gap-3 sm:grid-cols-2">
            <Button variant="game" size="xl" disabled={busy} onClick={newGame}>🔁 Play New Game</Button>
            <Button variant="secondary" size="xl" className="font-display" onClick={onLeave}>Leave Room</Button>
          </div>
        )}
      </div>
    </div>
  );
}
