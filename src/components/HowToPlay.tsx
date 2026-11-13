import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SEEN_KEY = "boostybun:howto-seen";

const STEPS: { icon: string; title: string; text: string }[] = [
  { icon: "🐰", title: "Set up", text: "Pick a name, a bunny (or selfie), a card background and a shape. Create a room and share the 6-letter code, or join a friend's. 2–10 players." },
  { icon: "✅", title: "Get ready", text: "Everyone taps “I'm ready”. The host starts the round once all players are ready." },
  { icon: "🃏", title: "Pass cards", text: "Each player gets 3 cards. On your turn, pick one card and pass it to the next player. Keep the cards you want!" },
  { icon: "🎯", title: "Goal", text: "Collect 3 cards that all show the same player. After the first full lap of passing, the VICTORY button unlocks." },
  { icon: "🏆", title: "Victory & Boost", text: "Holding 3 of a kind? Hit VICTORY! Then everyone races to tap BOOST — the faster you are, the more BoostyBuns you earn. The Victory winner gets +2 bonus." },
  { icon: "🔄", title: "Wild Swaps", text: "Collect BoostyBuns to claim Wild Swaps. Use one to swap the card you just received for a random card from the sender — they can defend with their own Wild Swap." },
  { icon: "👑", title: "Win the game", text: "Play as many rounds as you like. When the host ends the game, whoever has the most BoostyBuns is crowned the winner." },
];

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(SEEN_KEY)) setOpen(true); } catch { /* storage blocked */ }
  }, []);
  const change = (o: boolean) => {
    setOpen(o);
    if (!o) try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  };
  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="How to play"
      title="How to play"
      className="fixed top-1.5 right-12 z-40 inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-lg backdrop-blur transition-transform hover:scale-105 active:scale-95"
    >
      <Info className="size-5" />
    </button>
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">How to play</DialogTitle>
          <DialogDescription>Collect 3 of a kind. Then BOOST!</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-2xl border border-border bg-background/40 p-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-xl">{s.icon}</span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{i + 1}. {s.title}</p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <Button variant="game" size="xl" className="w-full" onClick={() => change(false)}>Let's play!</Button>
      </DialogContent>
    </Dialog>
  </>;
}
