import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CHAT_MAX, QUICK_CHAT, REACTIONS, type Action, type ChatMessage, type Reaction, type RoomState } from "@/lib/game";

type Send = (action: Action) => Promise<boolean | undefined>;

export function ChatButton({ onClick, unread }: { onClick: () => void; unread: number }) {
  return (
    <Button variant="outline" size="icon" className="relative" title="Chat and reactions" aria-label="Open chat and reactions" onClick={onClick}>
      <MessageCircle className="size-5" />
      {unread > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-gradient-orange px-1 text-[11px] leading-5 font-bold text-primary-foreground ring-2 ring-background">{unread > 9 ? "9+" : unread}</span>}
    </Button>
  );
}

/** One-tap emoji reactions; reused in the chat panel and the final celebration. */
export function ReactionBar({ send, className }: { send: Send; className?: string }) {
  const [sending, setSending] = useState(false);
  const react = async (text: string) => {
    if (sending) return;
    setSending(true);
    try { await send({ type: "signal", text }); } finally { setSending(false); }
  };
  return (
    <div className={cn("flex justify-between gap-1", className)}>
      {REACTIONS.map((emoji) => (
        <Button key={emoji} variant="ghost" className="h-11 min-w-0 flex-1 p-0 text-2xl transition-transform hover:-translate-y-0.5 hover:scale-110 active:scale-90" aria-label={`React ${emoji}`} disabled={sending} onClick={() => react(emoji)}>
          {emoji}
        </Button>
      ))}
    </div>
  );
}

export function ChatPanel({ state, meId, send, onClose }: { state: RoomState; meId: string; send: Send; onClose: () => void }) {
  const me = state.players.find((p) => p.id === meId);
  const isSpectator = me?.status === "spectator";
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const chat = state.chat ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const quick = async (msg: string) => {
    if (sending) return;
    setSending(true);
    try { await send({ type: "signal", text: msg }); } finally { setSending(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || sending || isSpectator) return;
    setSending(true);
    try { if (await send({ type: "chat", text: msg })) setText(""); } finally { setSending(false); }
  };

  return (
    <section role="dialog" aria-label="Room chat" className="panel panel-in fixed inset-x-2 bottom-2 z-[55] flex max-h-[72vh] flex-col overflow-hidden border-electric/40 text-card-foreground sm:right-4 sm:bottom-4 sm:left-auto sm:w-96">
      <header className="flex items-center justify-between gap-2 border-b bg-background/40 px-4 py-2">
        <h2 className="text-lg font-bold">💬 Chat <span className="text-sm font-normal text-muted-foreground">· {state.phase === "finished" ? "Final" : `Round ${state.round}`}</span></h2>
        <Button variant="ghost" size="icon" aria-label="Close chat" onClick={onClose}><X className="size-5" /></Button>
      </header>
      <ol ref={listRef} aria-live="polite" className="min-h-24 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {chat.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No messages this round yet. Say hi! 🐰</li>}
        {chat.map((m) => <ChatLine key={m.id} m={m} mine={m.playerId === meId} avatar={state.players.find((p) => p.id === m.playerId)?.avatar} />)}
      </ol>
      <div className="space-y-2 border-t bg-background/30 px-3 pt-2 pb-3">
        <ReactionBar send={send} />
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {QUICK_CHAT.map((msg) => (
            <button key={msg} type="button" disabled={sending} onClick={() => quick(msg)} className="shrink-0 rounded-full border border-electric/40 bg-surface-2 px-3 py-1.5 text-sm font-bold whitespace-nowrap text-foreground transition-[transform,border-color,background-color] hover:border-electric hover:bg-electric/15 active:scale-95 disabled:opacity-50">
              {msg}
            </button>
          ))}
        </div>
        {isSpectator ? (
          <p className="panel-inset px-3 py-2 text-center text-xs text-muted-foreground">👁️ Spectators can send quick messages and reactions, but not custom messages.</p>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input value={text} maxLength={CHAT_MAX} onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX))} placeholder="Type a message…" aria-label="Custom message" className="h-11 rounded-xl pr-12" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-muted-foreground">{text.length}/{CHAT_MAX}</span>
            </div>
            <Button type="submit" variant="game" className="h-11 px-4" disabled={sending || !text.trim()} aria-label="Send message"><Send className="size-4" /> Send</Button>
          </form>
        )}
      </div>
    </section>
  );
}

function ChatLine({ m, mine, avatar }: { m: ChatMessage; mine: boolean; avatar?: string }) {
  return (
    <li className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      <Avatar src={avatar} className="size-7 shrink-0 text-base" />
      <div className={cn("max-w-[75%] rounded-2xl px-3 py-1.5", mine ? "rounded-br-sm bg-gradient-orange text-primary-foreground" : "rounded-bl-sm border border-border bg-surface-2")}>
        {!mine && <p className="text-[11px] font-bold opacity-75">{m.name}</p>}
        <p className="text-sm break-words">{m.text}</p>
      </div>
    </li>
  );
}

type Bubble = ChatMessage & { avatar?: string };
type Floater = Reaction & { left: number; drift: number };

/**
 * Real-time floating overlay: chat bubbles near the bottom-left and emoji reactions rising
 * up the screen. Reactions never take pointer events, so they cannot block gameplay.
 */
export function SocialOverlay({ state, serverNow, hideBubbles, onOpenChat }: { state: RoomState; serverNow: number; hideBubbles: boolean; onOpenChat: () => void }) {
  const seenChat = useRef<number | null>(null);
  const seenReaction = useRef<number | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const nowRef = useRef(serverNow);
  nowRef.current = serverNow;

  useEffect(() => {
    const chat = state.chat ?? [];
    const reactions = state.reactions ?? [];
    const maxChat = chat.reduce((m, c) => Math.max(m, c.id), 0);
    const maxReaction = reactions.reduce((m, r) => Math.max(m, r.id), 0);
    if (seenChat.current === null || seenReaction.current === null) {
      seenChat.current = maxChat;
      seenReaction.current = maxReaction;
      return;
    }
    const fresh = (ts: number) => nowRef.current - ts < 8000;
    const newChat = chat.filter((c) => c.id > (seenChat.current ?? 0) && fresh(c.ts));
    const newReactions = reactions.filter((r) => r.id > (seenReaction.current ?? 0) && fresh(r.ts));
    seenChat.current = Math.max(seenChat.current, maxChat);
    seenReaction.current = Math.max(seenReaction.current, maxReaction);
    // Removal timers intentionally outlive re-renders; each removes only the items it added.
    if (newChat.length) {
      const added = newChat.map((c) => ({ ...c, avatar: state.players.find((p) => p.id === c.playerId)?.avatar }));
      setBubbles((b) => [...b, ...added].slice(-3));
      const ids = new Set(added.map((a) => a.id));
      setTimeout(() => setBubbles((b) => b.filter((x) => !ids.has(x.id))), 4000);
    }
    if (newReactions.length) {
      const added = newReactions.map((r) => ({ ...r, left: 12 + Math.random() * 76, drift: (Math.random() - 0.5) * 80 }));
      setFloaters((f) => [...f, ...added].slice(-24));
      const ids = new Set(added.map((a) => a.id));
      setTimeout(() => setFloaters((f) => f.filter((x) => !ids.has(x.id))), 3300);
    }
  }, [state.chat, state.reactions, state.players]);

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
        {floaters.map((f) => {
          const who = state.players.find((p) => p.id === f.playerId)?.name;
          return (
            <div key={f.id} className="reaction-rise absolute bottom-6 flex flex-col items-center" style={{ left: `${f.left}%`, "--drift": `${f.drift}px` } as CSSProperties}>
              <span className="text-5xl drop-shadow-lg">{f.text}</span>
              {who && <span className="mt-0.5 rounded-full border border-electric/40 bg-surface/90 px-1.5 text-[10px] font-bold text-foreground">{who}</span>}
            </div>
          );
        })}
      </div>
      {!hideBubbles && bubbles.length > 0 && (
        <div aria-live="polite" className="pointer-events-none fixed bottom-3 left-3 z-[58] flex max-w-[min(80vw,22rem)] flex-col items-start gap-2">
          {bubbles.map((b) => (
            <button key={b.id} type="button" onClick={onOpenChat} className="bubble-life pointer-events-auto flex items-center gap-2 rounded-2xl rounded-bl-sm border border-electric/50 bg-surface/95 px-3 py-2 text-left text-foreground shadow-[0_10px_30px_-10px_oklch(0_0_0/0.9),0_0_20px_-10px_var(--electric)] backdrop-blur-sm">
              <Avatar src={b.avatar} className="size-7 shrink-0 text-base" />
              <span className="min-w-0">
                <span className="block text-[11px] font-bold text-electric-glow">{b.name}</span>
                <span className="block text-sm leading-snug break-words">{b.text}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
