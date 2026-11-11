import { useEffect, useState, type CSSProperties } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { MaskedAvatar } from "@/components/PlayerCard";
import { cn } from "@/lib/utils";
import { cardBackFor } from "@/lib/brand";
import type { Card, RoomState } from "@/lib/game";

function cardStyle(card: Card, state: RoomState): CSSProperties {
  const owner = state.players.find((p) => p.id === card.owner);
  return { backgroundImage: `url(${cardBackFor(card.owner, state.players.map((p) => p.id), owner?.bg)})` };
}

function Face({ card, state }: { card: Card; state: RoomState }) {
  const owner = state.players.find(p => p.id === card.owner);
  return <>
    <span className="relative z-[2] flex flex-1 items-center justify-center pt-2">
      <span aria-hidden className="absolute size-[70%] rounded-full bg-[radial-gradient(circle,oklch(1_0_0/0.45)_0%,transparent_70%)]" />
      <MaskedAvatar src={owner?.avatar} mask={owner?.mask ?? 0} className="relative w-[64%]" />
    </span>
    <span className="relative z-[2] m-1.5 mt-0 block truncate rounded-lg bg-background/75 px-1.5 py-1 text-center text-[11px] font-extrabold text-foreground backdrop-blur-sm sm:text-xs">{owner?.name ?? "?"}</span>
  </>;
}

function Tile({ card, state, selected, onSelect, draggable }: { card: Card; state: RoomState; selected: boolean; onSelect?: () => void; draggable: boolean }) {
  const drag = useDraggable({ id: card.id, disabled: !draggable });
  const drop = useDroppable({ id: card.id, disabled: !draggable });
  return <div ref={drop.setNodeRef} className={cn("relative min-w-0 rounded-[1.2rem]", drop.isOver && "ring-2 ring-electric ring-offset-2 ring-offset-background")}>
    <div ref={drag.setNodeRef} className={cn("relative", drag.isDragging && "opacity-30")}>
      <button type="button" data-sfx="tap" aria-label={`Select card ${card.id}`} aria-pressed={selected} disabled={!onSelect} onClick={onSelect}
        {...(draggable ? drag.listeners : {})} title={draggable ? "Tap to select, long-press to move" : undefined}
        style={cardStyle(card, state)}
        className={cn("game-card flex aspect-[5/7] w-full min-w-0 cursor-pointer select-none flex-col bg-surface p-0 disabled:cursor-default [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric", draggable && "touch-manipulation")}>
        <Face card={card} state={state} />
        {selected && <span aria-hidden className="absolute top-2 right-2 z-[3] grid size-6 place-items-center rounded-full bg-electric text-xs font-black text-accent-foreground shadow-blue-glow">✓</span>}
      </button>
    </div>
  </div>;
}

export function PlayerHand({ hand, state, viewId, selectedId, onSelect }: { hand: Card[]; state: RoomState; viewId: string; selectedId: string | null; onSelect?: (id: string) => void }) {
  const received = hand.length === 4 && state.lastPass?.to === viewId ? hand.find(c => c.id === state.lastPass?.cardId) : undefined;
  const originals = hand.filter(c => c.id !== received?.id);
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const key = originals.map(c => c.id).sort().join(",");
  useEffect(() => { setOrder(prev => [...prev.filter(id => originals.some(c => c.id === id)), ...originals.filter(c => !prev.includes(c.id)).map(c => c.id)]); }, [key, viewId]);
  const sorted = [...originals].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { delay: 300, tolerance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }));
  const dragged = originals.find(c => c.id === dragId);
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={({ active, over }) => {
    setDragId(null);
    if (!over || active.id === over.id) return;
    setOrder(prev => { const next = [...prev]; const a = next.indexOf(String(active.id)); const b = next.indexOf(String(over.id)); if (a >= 0 && b >= 0) [next[a], next[b]] = [next[b], next[a]]; return next; });
  }}>
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:justify-center">
      <div className="grid w-full max-w-[26rem] grid-cols-3 gap-3 pt-3 sm:gap-4" aria-label="Original cards">
        {sorted.map(card => <Tile key={card.id} card={card} state={state} selected={selectedId === card.id} onSelect={onSelect ? () => onSelect(card.id) : undefined} draggable={!!onSelect} />)}
      </div>
      {received && <section className="screen-in w-full max-w-[26rem] sm:w-auto">
        <div className="flex items-center gap-3 rounded-[1.4rem] border border-electric/50 bg-electric/10 p-3 shadow-[0_0_30px_-12px_var(--electric)] sm:flex-col sm:items-stretch sm:p-2.5">
          <h3 className="flex-1 text-sm font-bold text-electric-glow sm:flex-none sm:text-center">✨ Received Card</h3>
          <div className="w-24 sm:w-28"><Tile card={received} state={state} selected={selectedId === received.id} onSelect={onSelect ? () => onSelect(received.id) : undefined} draggable={false} /></div>
        </div>
      </section>}
    </div>
    <DragOverlay>{dragged && <div style={cardStyle(dragged, state)} aria-pressed="true" className="game-card flex aspect-[5/7] w-28 flex-col rotate-3 bg-surface"><Face card={dragged} state={state} /></div>}</DragOverlay>
  </DndContext>;
}
