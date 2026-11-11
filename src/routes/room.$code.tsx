import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { loadSession, saveSession, type Session } from "@/lib/session";
import { roomAction } from "@/lib/room.functions";
import {
  activePlayers,
  isWinningHand,
  swapsAvailable,
  swapsClaimable,
  swapProgress,
  nextActive,
  type Action,
  type RoomState,
} from "@/lib/game";
import { cn } from "@/lib/utils";
import { useGameSounds } from "@/hooks/use-game-sounds";
import { sfx } from "@/lib/sfx";
import { PlayerHand } from "@/components/PlayerHand";
import { RoundReward } from "@/components/RoundReward";
import { SwapCelebration } from "@/components/SwapCelebration";
import { useRoomConnection } from "@/hooks/use-room-connection";
import { useServerNow, useServerOffset } from "@/hooks/use-server-clock";
import { ChatButton, ChatPanel, SocialOverlay } from "@/components/LiveSocial";
import { SwapDefence } from "@/components/SwapDefence";
import { WildSwapCard } from "@/components/WildSwapCard";
import { PlayerStrip } from "@/components/PlayerStrip";
import { DisconnectNotices, useDisconnected } from "@/components/DisconnectNotices";
import { FinalCelebration } from "@/components/FinalCelebration";
import { BoostStage } from "@/components/BoostButton";
import { Buns, Coin, LogoBadge, Wordmark } from "@/components/Brand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — BoostyBun` },
      { name: "description", content: `Play BoostyBun in room ${params.code}.` },
      { property: "og:title", content: `BoostyBun room ${params.code}` },
      { property: "og:description", content: "Join the room and start passing cards!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [missing, setMissing] = useState(false);
  const versionRef = useRef(-1);
  const seenEvent = useRef<number | null>(null);
  const connection = useRoomConnection(session);
  const clock = useServerOffset();
  const recordClock = clock.record;

  useEffect(() => {
    const s = loadSession();
    if (!s || s.code !== code) navigate({ to: "/", search: { join: code } });
    else setSession(s);
  }, [code, navigate]);

  const applyRow = useCallback((row: { state: unknown; version: number; updated_at?: string } | null) => {
    if (!row) return setMissing(true);
    recordClock(row.updated_at);
    if (row.version < versionRef.current) return;
    versionRef.current = row.version;
    setState(row.state as RoomState);
  }, [recordClock]);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    const fetchRow = () =>
      supabase
        .from("rooms")
        .select("state, version, updated_at")
        .eq("code", code)
        .maybeSingle()
        .then(({ data, error }) => { if (alive && !error) applyRow(data); });
    fetchRow();
    const ch = supabase
      .channel(`room-${code}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, (p) =>
        applyRow(p.new as { state: unknown; version: number; updated_at?: string }),
      )
      .subscribe((status) => status === "SUBSCRIBED" && fetchRow());
    const poll = setInterval(fetchRow, 2000);
    return () => {
      alive = false;
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [session, code, applyRow]);

  const act = useCallback(
    async (action: Action) => {
      if (!session) return;
      if (connection.disconnected) return false;
      const res = await roomAction({ data: { ...session, action } }).catch((e) => ({ error: String(e) }));
      if ("error" in res && res.error) {
        if (action.type !== "heartbeat") toast.error(res.error);
        return false;
      }
      return true;
    },
    [session, connection.disconnected],
  );

  // Toast new events
  useEffect(() => {
    if (!state || !session) return;
    if (seenEvent.current === null) {
      seenEvent.current = state.seq;
      return;
    }
    for (const e of state.events) {
      if (e.id > seenEvent.current && (!e.to || e.to === session.playerId)) {
        if (e.to) toast.warning(e.text);
        else toast(e.text);
      }
    }
    seenEvent.current = state.seq;
  }, [state, session]);

  if (connection.expired) return <Gone text="Your reconnect time expired. You are no longer in this room." onHome={() => saveSession(null)} />;
  if (missing) return <Gone text="This room doesn't exist." />;
  if (!state || !session) return <LoadingRoom code={code} />;
  const me = state.players.find((p) => p.id === session.playerId);
  if (!me) return <Gone text="You are no longer in this room." onHome={() => saveSession(null)} />;

  return <>
    {connection.disconnected && <div role="alert" className="screen-in fixed inset-x-0 bottom-0 z-40 border-t-2 border-destructive/70 bg-surface/95 p-3 text-center shadow-[0_-12px_30px_-12px_oklch(0_0_0/0.8)] backdrop-blur">
      <p className="font-display text-lg font-bold text-destructive">🔌 Connection lost · <span className="tabular-nums">{connection.seconds}s</span> to reconnect</p>
      <p className="text-sm text-muted-foreground"><span className="soft-blink">{connection.seconds > 0 ? "Reconnecting… Your session is saved." : "Reconnect time expired. Waiting for connection…"}</span></p>
    </div>}
    <div className={cn(connection.disconnected && "pointer-events-none opacity-60")} inert={connection.disconnected || undefined}><Game state={state} meId={me.id} act={act} serverOffset={clock.offset} offline={connection.disconnected} onLeave={async () => {
    await act({ type: "leave" });
    saveSession(null);
    navigate({ to: "/" });
  }} /></div></>;
}

function LoadingRoom({ code }: { code: string }) {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <LogoBadge className="float-y size-28" />
      <Wordmark className="text-4xl" />
      <p className="font-display text-lg text-muted-foreground"><span className="soft-blink">Joining room {code}…</span></p>
      <div className="h-2 w-48 overflow-hidden rounded-full shimmer" />
    </div>
  );
}

function Gone({ text, onHome }: { text: string; onHome?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel screen-in flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center">
        <LogoBadge className="size-24 opacity-90 grayscale-[30%]" />
        <p className="font-display text-xl font-bold">{text}</p>
        <Button variant="game" size="xl" className="w-full" asChild onClick={onHome}>
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}

function Game({ state, meId, act, onLeave, serverOffset, offline }: {
  state: RoomState;
  meId: string;
  act: (a: Action) => Promise<boolean | undefined>;
  onLeave: () => void;
  serverOffset: number;
  offline: boolean;
}) {
  const serverNow = useServerNow(serverOffset, 1000);
  useGameSounds(state, meId);
  const disconnected = useDisconnected(state, meId, serverNow, offline);
  const offlineIds = new Set(disconnected.map((d) => d.player.id));
  const [chatOpen, setChatOpen] = useState(false);
  const chatMax = (state.chat ?? []).reduce((m, c) => Math.max(m, c.id), 0);
  const [readUpTo, setReadUpTo] = useState(chatMax);
  useEffect(() => { if (chatOpen) setReadUpTo(chatMax); }, [chatOpen, chatMax]);
  const unread = (state.chat ?? []).filter((c) => c.id > readUpTo && c.playerId !== meId).length;
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [celebrate, setCelebrate] = useState(false);
  const [rewardSeen, setRewardSeen] = useState<number | null>(null);
  const finishRewards = useCallback(() => setRewardSeen(state.rewards?.round ?? null), [state.rewards?.round]);
  useEffect(() => setSelectedId(null), [state.round, state.passes, state.lastPass?.cardId]);
  const me = state.players.find(p => p.id === meId);
  const run = async (action: Action) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { const ok = await act(action); if (ok && action.type === "pass") setSelectedId(null); if (ok && action.type === "claimSwap") { sfx("claim"); setCelebrate(true); } if (ok && action.type === "ready") sfx("ready"); }
    finally { pending.current = false; setBusy(false); }
  };
  if (!me) return null;
  const isHost = state.hostId === meId;
  const actives = activePlayers(state);
  const isSpectator = me.status === "spectator";
  const viewId = isSpectator ? (watchId && state.hands[watchId] ? watchId : actives[0]?.id ?? "") : meId;
  const viewHand = state.hands[viewId] ?? [];
  const myTurn = state.turnId === meId && state.phase === "playing";
  const lp = state.lastPass;
  const canSwap = !state.pendingSwap && myTurn && lp?.to === meId && !lp.swapped && swapsAvailable(me) > 0 && !!state.hands[lp.from]?.length;
  const canVictory = !state.pendingSwap && state.phase === "playing" && state.round1Done && isWinningHand(state.hands[meId]);
  const turnName = state.players.find(p => p.id === state.turnId)?.name;
  const nextName = state.players.find(p => p.id === nextActive(state, myTurn ? meId : state.turnId ?? viewId))?.name;
  const showReward = state.phase === "lobby" && state.rewards && rewardSeen !== state.rewards.round;
  const claimable = swapsClaimable(me);
  const { have, need } = swapProgress(me);
  const progress = claimable > 0 ? need : have;
  const claimButton = claimable > 0 && <Button variant="game" size="xl" className="w-full" data-sfx="none" disabled={busy} onClick={() => run({ type: "claimSwap", claimNumber: (me.swapsClaimed ?? me.swapsUsed) + 1 })}><WildSwapCard className="w-6" />Claim Wild Swap</Button>;
  const powerPanel = !isSpectator && <section className="panel space-y-3 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-lg font-bold">Your Wild Swaps</h3>
      <WildSwapCard className="w-12" count={swapsAvailable(me)} label={`${swapsAvailable(me)} Wild Swaps available`} />
    </div>
    <progress aria-label="Wild Swap progress" value={progress} max={need} className="h-3 w-full" />
    <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><Buns amount={`${progress}/${need}`} className="text-foreground" coinClassName="size-4" /> BoostyBuns · {claimable > 0 ? `${claimable} power${claimable === 1 ? "" : "s"} to claim` : need - progress === 1 ? "One more needed" : "Next Wild Swap"}</p>
    {claimButton}
  </section>;
  const social = <>
    <SocialOverlay state={state} serverNow={serverNow} hideBubbles={chatOpen} onOpenChat={openChat} />
    {chatOpen && state.phase !== "lobby" && <ChatPanel state={state} meId={meId} send={act} onClose={closeChat} />}
  </>;
  if (state.phase === "finished") return <>
    <FinalCelebration state={state} meId={meId} serverNow={serverNow} send={act} onLeave={onLeave} />
    {social}
  </>;
  const spectators = state.players.filter(p => p.status === "spectator").length;
  const standings = [...state.players].sort((a,b) => b.score - a.score);
  return <main className="mx-auto max-w-3xl space-y-4 px-3 pt-3 pb-32 sm:space-y-5 sm:p-6 sm:pb-32">
    {social}
    {celebrate && <SwapCelebration onClose={() => setCelebrate(false)} />}
    {state.pendingSwap?.defender === meId && <SwapDefence key={state.pendingSwap.id} incoming={state.pendingSwap} attackerName={state.players.find(p => p.id === state.pendingSwap?.attacker)?.name ?? "Someone"} me={me} busy={busy} respond={run} />}
    <header className="panel flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <LogoBadge className="size-11 shrink-0 sm:size-12" />
        <div className="min-w-0">
          <h1 className="text-2xl leading-none sm:text-3xl"><Wordmark /></h1>
          <button type="button" title="Copy room code" className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-electric/40 bg-background/50 px-2 py-0.5 font-display text-sm font-bold tracking-[0.18em] text-electric-glow transition-colors hover:border-electric hover:bg-electric/10 active:scale-95" onClick={async () => { try { await navigator.clipboard.writeText(state.code); toast.success("Room code copied"); } catch { toast.error("Could not copy room code"); } }}>
            <span className="text-[10px] tracking-normal text-muted-foreground">ROOM</span>{state.code}<span aria-hidden className="text-xs">📋</span>
          </button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        {state.phase !== "lobby" && <span className="rounded-full bg-background/50 px-2 py-0.5 text-xs font-bold text-muted-foreground">👁️ {spectators} Spectating</span>}
        <div className="flex gap-2">{state.phase !== "lobby" && <ChatButton onClick={() => setChatOpen((o) => !o)} unread={unread} />}{isHost && state.phase !== "lobby" && <Button variant="destructive" disabled={busy} onClick={() => run({ type: "endRound" })}>End Round</Button>}<Button variant="outline" onClick={onLeave}>Leave</Button></div>
      </div>
    </header>
    <DisconnectNotices list={disconnected} />
    {showReward && state.rewards ? <RoundReward rewards={state.rewards} state={state} meId={meId} onDone={finishRewards} claim={!isSpectator && claimButton} /> : <>
      {state.phase === "lobby" && <section className="panel screen-in space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Lobby {state.round > 0 && <span className="text-muted-foreground">· after round {state.round}</span>}</h2>
            <p className="text-sm text-muted-foreground">{isHost ? "Start when everyone is ready." : "Waiting for the host to start."}</p>
          </div>
          <span className="rounded-full border border-border bg-background/50 px-3 py-1 font-display text-sm font-bold"><span className="text-electric-glow">{actives.length}</span>/10 players</span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">{state.players.map((p, i) => {
          const ready = p.status !== "spectator" && (p.id === state.hostId || p.ready);
          return <li key={p.id} style={{ animationDelay: `${i * 0.05}s` }} className={cn("reward-pop flex items-center gap-3 rounded-2xl border p-2.5 transition-colors", p.id === meId ? "border-electric/70 bg-electric/10" : "border-border bg-background/40")}>
            <Avatar src={p.avatar} className={cn("size-11", p.status === "spectator" && "opacity-60 grayscale")} />
            <span className="min-w-0 flex-1 break-words font-bold">{p.name} {p.id === state.hostId && "👑"} {p.id === meId && <span className="text-electric-glow">(you)</span>}</span>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold", p.status === "spectator" ? "bg-muted text-muted-foreground" : p.id === state.hostId ? "bg-gold/15 text-gold" : ready ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{p.status === "spectator" ? "Spectator" : p.id === state.hostId ? "Host" : p.ready ? "Ready ✓" : "Not ready"}</span>
          </li>;
        })}</ul>
        {!isSpectator && !isHost && <Button variant={me.ready ? "secondary" : "game"} size="xl" className="w-full font-display" disabled={busy} onClick={() => run({ type: "ready", ready: !me.ready })}>{me.ready ? "Not ready" : "I'm ready"}</Button>}
        {isHost && <Button variant="game" size="xl" className="w-full" disabled={busy || actives.length < 2 || actives.some(p => p.id !== meId && !p.ready)} onClick={() => run({ type: "start" })}>Start game</Button>}
        {isHost && <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="finale" size="xl" className="w-full" disabled={busy || state.round === 0}>🏁 End Game</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-2xl">End the whole game?</AlertDialogTitle>
              <AlertDialogDescription>No more rounds will be played. Total BoostyBuns are tallied and the winner is crowned for everyone in the room.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Keep playing</AlertDialogCancel>
              <AlertDialogAction className="rounded-xl font-display" onClick={() => run({ type: "endGame" })}>End Game & crown winner</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>}
        {isHost && state.round === 0 && <p className="text-center text-xs text-muted-foreground">End Game unlocks after the first round.</p>}
      </section>}
      {state.phase === "boost" && <section className="panel screen-in flex flex-col items-center gap-2 overflow-hidden px-4 py-6 text-center">
        <p className="text-xs font-extrabold tracking-widest text-primary uppercase">🏆 Victory claimed</p>
        <h2 className="text-2xl font-bold sm:text-3xl">{state.players.find(p => p.id === state.winnerId)?.name} claimed Victory!</h2>
        <BoostStage
          canBoost={!!state.boost?.participants.includes(meId) && !state.boost.order.includes(meId)}
          disabled={busy}
          onBoost={() => run({ type: "boost" })}
          waiting={<p className="font-display text-xl text-muted-foreground">{isSpectator ? "Players are boosting…" : "Boosted! Waiting for others…"}</p>}
        />
        {!!state.boost?.order.length && <ol className="w-full max-w-sm space-y-2">{state.boost.order.map((id, i) => {
          const p = state.players.find(x => x.id === id);
          return <li key={id} className={cn("reward-pop flex items-center gap-3 rounded-2xl border px-3 py-2", id === meId ? "border-electric/70 bg-electric/10" : "border-border bg-background/40")}>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full font-display font-bold", i === 0 ? "bg-gradient-orange text-primary-foreground" : "bg-surface-2 text-foreground")}>#{i + 1}</span>
            <Avatar src={p?.avatar} className="size-8" />
            <span className="min-w-0 flex-1 truncate text-left font-bold">{p?.name}</span>
          </li>;
        })}</ol>}
      </section>}
      {state.phase === "playing" && <section className="space-y-4 sm:space-y-5">
        <div className={cn("panel flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-shadow", myTurn && "border-primary/70 shadow-[var(--shadow-panel),0_0_30px_-8px_var(--primary)]")}>
          <div className="min-w-0">
            <h2 className={cn("text-2xl font-bold sm:text-3xl", myTurn && "text-primary")}>{myTurn ? "Your turn" : `${turnName}'s turn`}</h2>
            <p className="text-sm text-muted-foreground">Next: <span className="font-bold text-electric-glow">{nextName}</span></p>
          </div>
          {myTurn && <span className="glow-pulse rounded-full bg-gradient-orange px-3 py-1 font-display text-sm font-bold text-primary-foreground">Pick a card</span>}
        </div>
        {state.pendingSwap && <p role="status" className="rounded-2xl border border-electric/50 bg-electric/10 px-3 py-2 text-sm font-bold text-electric-glow"><span className="soft-blink inline-flex items-center gap-2"><WildSwapCard className="w-5" />Waiting for {state.players.find(p => p.id === state.pendingSwap?.defender)?.name}'s Wild Swap response…</span></p>}
        <PlayerStrip state={state} meId={meId} offlineIds={offlineIds} />
        {isSpectator && <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-muted-foreground">👁️ Watching:</span>{actives.map(p => <Button key={p.id} size="sm" variant={p.id === viewId ? "default" : "outline"} onClick={() => setWatchId(p.id)}>{p.name}</Button>)}</div>}
        <PlayerHand state={state} hand={viewHand} viewId={viewId} selectedId={selectedId} onSelect={!isSpectator ? setSelectedId : undefined} />
        {!isSpectator && canSwap && <div className="screen-in flex flex-col items-center gap-1">
          <WildSwapCard className="w-24 sm:w-28" count={swapsAvailable(me)} disabled={busy} onClick={() => run({ type: "swap" })} label={`Use Wild Swap (${swapsAvailable(me)} left)`} />
          <span className="font-display text-sm font-bold text-electric-glow">Tap to Wild Swap</span>
        </div>}
        {!isSpectator && <div className="flex flex-col items-center gap-3">
          {myTurn && selectedId && viewHand.some(c => c.id === selectedId) && <Button variant="game" size="xl" className="screen-in w-full max-w-md whitespace-normal" disabled={busy || !!state.pendingSwap} onClick={() => run({ type: "pass", cardId: selectedId, round: state.round, passes: state.passes })}>Pass to {nextName} →</Button>}
          {state.round1Done && <Button variant="victory" size="xl" className={cn("mx-auto h-16 w-full max-w-md text-2xl sm:h-20 sm:text-3xl", canVictory ? "glow-pulse" : "opacity-60")} disabled={busy || !canVictory} onClick={() => run({ type: "victory" })}>🏆 VICTORY</Button>}
        </div>}
      </section>}
      {powerPanel}
      {state.phase === "lobby" && <section className="panel space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Coin className="size-7" /> Leaderboard</h2>
        <ul className="space-y-2">{standings.map((p, i) => <li key={p.id} className={cn("flex items-center gap-3 rounded-2xl border px-3 py-2", p.id === meId ? "border-electric/70 bg-electric/10" : "border-border bg-background/40")}>
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold", i === 0 && p.score > 0 ? "bg-gradient-orange text-primary-foreground" : "bg-surface-2 text-muted-foreground")}>{i + 1}</span>
          <Avatar src={p.avatar} className="size-10" />
          <span className="min-w-0 flex-1 break-words font-bold">{p.name}</span>
          <Buns amount={p.score} className="shrink-0 text-lg text-primary" coinClassName="size-6" />
        </li>)}</ul>
      </section>}
    </>}
  </main>;
}
