import { useEffect, useRef } from "react";
import type { RoomState } from "@/lib/game";
import { sfx } from "@/lib/sfx";

/** Plays sounds for things that happen in the shared room state, so every player hears them at the right moment. */
export function useGameSounds(state: RoomState, meId: string) {
  const prev = useRef<RoomState | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!p) return; // first render: don't replay history
    const me = state.players.find((x) => x.id === meId);
    const pm = p.players.find((x) => x.id === meId);

    // Phase changes
    if (p.phase !== state.phase) {
      if (state.phase === "playing" && p.phase === "lobby") return sfx("start");
      if (state.phase === "boost") return sfx("boost");
      if (state.phase === "finished") {
        const won = state.final?.winners.includes(meId);
        sfx(won ? "victory" : "reward");
        setTimeout(() => sfx("confetti"), 900);
        return;
      }
      if (state.phase === "lobby" && state.rewards && state.rewards.round !== p.rewards?.round) {
        sfx(state.rewards.winnerId === meId ? "victory" : "reward");
        setTimeout(() => sfx("confetti"), 900);
        return;
      }
    }

    // Wild Swap used
    if ((state.swapSequence ?? 0) > (p.swapSequence ?? 0) || (state.pendingSwap && state.pendingSwap.id !== p.pendingSwap?.id)) {
      sfx(state.pendingSwap?.defender === meId ? "alert" : "swap");
      if (state.pendingSwap?.defender !== meId) return;
    }
    if (p.pendingSwap && !state.pendingSwap) sfx("swap");

    // Card movement
    const lp = state.lastPass;
    const plp = p.lastPass;
    const newPass = lp && (lp.cardId !== plp?.cardId || lp.from !== plp?.from || state.passes !== p.passes);
    if (newPass && lp) {
      if (lp.from === meId) sfx("send");
      else if (lp.to === meId) sfx("receive");
      else sfx("pass");
    }

    // My turn
    if (state.phase === "playing" && state.turnId === meId && p.turnId !== meId && !newPass) sfx("turn");

    // Players joining / readying in the lobby
    if (state.players.length > p.players.length) sfx("join");

    // Chat & reactions from others
    const chat = state.chat ?? [];
    const pMax = (p.chat ?? []).reduce((m, c) => Math.max(m, c.id), 0);
    if (chat.some((c) => c.id > pMax && c.playerId !== meId)) sfx("pop");
    const rMax = (p.reactions ?? []).reduce((m, r) => Math.max(m, r.id), 0);
    if ((state.reactions ?? []).some((r) => r.id > rMax && r.playerId !== meId)) sfx("pop");

    // Score up (BoostyBuns earned)
    if (me && pm && me.score > pm.score && state.phase === p.phase) sfx("claim");
  }, [state, meId]);
}
