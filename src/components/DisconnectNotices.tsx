import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { disconnectedPlayers, type RoomState } from "@/lib/game";

/**
 * Everyone sees who dropped and the shared countdown. Deadlines come from each player's last
 * server heartbeat, so all devices count down to the same moment.
 */
export function useDisconnected(state: RoomState, meId: string, serverNow: number, paused: boolean) {
  const list = paused ? [] : disconnectedPlayers(state, serverNow).filter((d) => d.player.id !== meId);
  const prev = useRef<Map<string, string> | null>(null);
  const key = list.map((d) => d.player.id).sort().join(",");
  useEffect(() => {
    const current = new Map(list.map((d) => [d.player.id, d.player.name]));
    if (prev.current) {
      for (const [id, name] of current) if (!prev.current.has(id)) toast.warning(`${name} disconnected — reconnecting…`);
      for (const [id, name] of prev.current) {
        if (!current.has(id) && state.players.some((p) => p.id === id)) toast.success(`${name} reconnected`);
      }
    }
    prev.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return list;
}

export function DisconnectNotices({ list }: { list: ReturnType<typeof disconnectedPlayers> }) {
  if (!list.length) return null;
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      {list.map(({ player, seconds }) => (
        <div key={player.id} className="screen-in flex items-center gap-3 rounded-2xl border border-primary/50 bg-surface-2/90 px-3 py-2 text-foreground shadow-[0_0_24px_-12px_var(--primary)]">
          <Avatar src={player.avatar} className="size-8 shrink-0 text-lg grayscale" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-bold">{player.name}</span> disconnected – <span className="soft-blink text-muted-foreground">Reconnecting…</span>
          </p>
          <span className="shrink-0 rounded-full bg-gradient-orange px-2.5 py-0.5 font-display text-sm font-bold text-primary-foreground tabular-nums">{seconds}s</span>
        </div>
      ))}
    </div>
  );
}
