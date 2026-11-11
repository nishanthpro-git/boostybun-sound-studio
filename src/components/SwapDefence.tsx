import { useState } from "react";
import { WildSwapCard } from "@/components/WildSwapCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { swapsAvailable, type Action, type Player, type RoomState } from "@/lib/game";

export function SwapDefence({ incoming, attackerName, me, busy, respond }: {
  incoming: NonNullable<RoomState["pendingSwap"]>;
  attackerName: string;
  me: Player;
  busy: boolean;
  respond: (action: Action) => void;
}) {
  const [insufficient, setInsufficient] = useState(false);
  const answer = (defend: boolean) => respond({ type: "respondSwap", swapId: incoming.id, defend });
  return <Dialog open onOpenChange={() => {}}>
    <DialogContent className="max-w-sm border-2 border-destructive/60 text-center shadow-[var(--shadow-panel),0_0_50px_-12px_var(--destructive)] [&>button]:hidden" onEscapeKeyDown={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
      <WildSwapCard className="swap-burst mx-auto w-24" />
      <DialogTitle className="text-center text-2xl leading-snug">{attackerName} used Wild Swap on you!</DialogTitle>
      <DialogDescription className="text-center font-bold">{insufficient ? "You don't have enough Wild Swap powers to defend!" : `${swapsAvailable(me)} Wild Swap powers available`}</DialogDescription>
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" className="flex-1 px-4 font-display" disabled={busy} onClick={() => answer(false)}>OK</Button>
        {!insufficient && <Button variant="game" size="lg" className="flex-1 px-4" disabled={busy} onClick={() => swapsAvailable(me) > 0 ? answer(true) : setInsufficient(true)}>DEFEND</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
