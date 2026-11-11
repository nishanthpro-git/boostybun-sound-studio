import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import type { RoomState } from "@/lib/game";

/** Compact horizontal row of circular player portraits; the current turn glows orange. */
export function PlayerStrip({ state, meId, offlineIds }: { state: RoomState; meId: string; offlineIds: Set<string> }) {
  return (
    <ul aria-label="Players" className="panel-inset flex gap-3 overflow-x-auto px-3 pt-3 pb-2 [scrollbar-width:thin]">
      {state.players.map((p) => {
        const active = p.id === state.turnId && state.phase === "playing";
        const offline = offlineIds.has(p.id);
        return (
          <li key={p.id} className="flex w-14 shrink-0 flex-col items-center gap-1.5" aria-current={active ? "true" : undefined}>
            <span className={cn("relative transition-transform duration-300", active && "scale-110")}>
              <Avatar
                src={p.avatar}
                className={cn(
                  "size-11 text-2xl transition-shadow",
                  active && "glow-pulse",
                  (offline || p.status === "spectator") && "opacity-50 grayscale",
                )}
              />
              {active && <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-gradient-orange text-[9px] font-black text-primary-foreground ring-2 ring-background">▶</span>}
              {offline && <span className="absolute -right-1 -bottom-1 text-xs" title="Disconnected">🔌</span>}
              {!offline && p.status === "spectator" && <span className="absolute -right-1 -bottom-1 text-xs" title="Spectator">👁️</span>}
            </span>
            <span className={cn("w-full truncate text-center text-[11px] leading-tight font-extrabold", active ? "text-primary" : p.id === meId ? "text-electric-glow" : "text-muted-foreground")}>
              {p.id === meId ? "You" : p.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
