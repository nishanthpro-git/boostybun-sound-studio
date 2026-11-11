// Pure, deterministic-ish game reducer for BoostyBun. Runs on the server; clients only render state.

export const MAX_ACTIVE = 10;
export const MIN_ACTIVE = 2;
export const DISCONNECT_MS = 60_000;
export const BOOST_TIMEOUT_MS = 15_000;
export const REACTIONS = ["😂", "😭", "👀", "🔥", "💀", "🐰", "❤️"] as const;
export const QUICK_CHAT = ["Don't you dare! 😭", "I know what you're doing 👀", "Give it back!", "Nice try!", "I'm watching you!", "HELP! 💀", "Good luck! 🐰"] as const;
export const SIGNAL_MS = 5_000;
export const CHAT_MAX = 50;
export const CELEBRATION_MS = 10_000;
/** A player whose last server heartbeat is older than this is shown as disconnected to everyone. */
export const PRESENCE_GRACE_MS = 7_000;

export type Card = { id: string; owner: string };
export type Player = {
  id: string;
  name: string;
  avatar: string; // emoji or data URL
  /** Chosen card background index and avatar mask shape (cosmetic only). */
  bg?: number;
  mask?: number;
  tokenHash: string;
  ready: boolean;
  lastSeen: number;
  score: number;
  swapsUsed: number;
  swapsClaimed?: number;
  status: "active" | "spectator";
};
export type GameEvent = { id: number; ts: number; text: string; to?: string };
export type LastPass = { from: string; to: string; cardId: string; swapped: boolean };
export type Boost = { order: string[]; startedAt: number; participants: string[] };

export type RoundRewards = { round: number; winnerId: string | null; entries: { playerId: string; earned: number; bonus: number; before: number; total: number }[] };

export type ChatMessage = { id: number; playerId: string; name: string; text: string; ts: number; custom: boolean };
export type Reaction = { id: number; playerId: string; text: string; ts: number };
export type FinalResult = { endedAt: number; winners: string[]; standings: { playerId: string; name: string; score: number }[] };

export type RoomState = {
  code: string;
  hostId: string;
  phase: "lobby" | "playing" | "boost" | "finished";
  players: Player[];
  hands: Record<string, Card[]>;
  turnId: string | null;
  firstId: string | null;
  passes: number;
  round1Done: boolean;
  lastPass: LastPass | null;
  winnerId: string | null;
  boost: Boost | null;
  round: number;
  events: GameEvent[];
  seq: number;
  rewards?: RoundRewards | null;
  pendingSwap?: { id: number; attacker: string; defender: string; cardId: string } | null;
  swapSequence?: number;
  signals?: Record<string, { text: string; ts: number }>;
  /** Current round's chat (predefined + custom). Cleared when a new round begins. */
  chat?: ChatMessage[];
  /** Short-lived emoji reactions for floating animations; never part of chat history. */
  reactions?: Reaction[];
  socialSeq?: number;
  final?: FinalResult | null;
};

export type Action =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "pass"; cardId: string; round: number; passes: number }
  | { type: "victory" }
  | { type: "boost" }
  | { type: "swap" }
  | { type: "respondSwap"; swapId: number; defend: boolean }
  | { type: "signal"; text: string }
  | { type: "chat"; text: string }
  | { type: "claimSwap"; claimNumber: number }
  | { type: "endRound" }
  | { type: "endGame" }
  | { type: "newGame" }
  | { type: "leave" }
  | { type: "heartbeat" };

export class GameError extends Error {}
const fail = (msg: string): never => {
  throw new GameError(msg);
};

export function swapsAvailable(p: Player) {
  return Math.max(0, (p.swapsClaimed ?? p.swapsUsed) - p.swapsUsed);
}

/** BoostyBuns needed for the nth Wild Swap (1-based): 5, 10, then 15 forever. */
export function swapCost(n: number) {
  return Math.min(15, 5 * n);
}

/** Total BoostyBuns required to unlock `count` Wild Swaps. */
export function swapThreshold(count: number) {
  let t = 0;
  for (let i = 1; i <= count; i++) t += swapCost(i);
  return t;
}

export function swapsEarned(score: number) {
  let n = 0;
  while (swapThreshold(n + 1) <= score) n++;
  return n;
}

export function swapsClaimable(p: Player) {
  return Math.max(0, swapsEarned(p.score) - (p.swapsClaimed ?? p.swapsUsed));
}

/** Meter progress toward the next unclaimed Wild Swap. */
export function swapProgress(p: Player) {
  const claimed = p.swapsClaimed ?? p.swapsUsed;
  const need = swapCost(claimed + 1);
  return { have: Math.min(need, Math.max(0, p.score - swapThreshold(claimed))), need };
}

/** Players (other than nobody) whose server heartbeat lapsed; seconds left until safe removal. */
export function disconnectedPlayers(s: RoomState, serverNow: number) {
  return s.players
    .filter((p) => serverNow - p.lastSeen >= PRESENCE_GRACE_MS)
    .map((p) => ({ player: p, seconds: Math.max(0, Math.ceil((p.lastSeen + DISCONNECT_MS - serverNow) / 1000)) }));
}

/** Everyone tied on the highest total BoostyBuns wins jointly. */
export function finalWinners(players: { id: string; score: number }[]) {
  if (!players.length) return [];
  const top = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === top).map((p) => p.id);
}

function lastReactionTs(s: RoomState, pid: string) {
  return s.reactions?.filter((r) => r.playerId === pid).at(-1)?.ts;
}

function lastChatTs(s: RoomState, pid: string) {
  return s.chat?.filter((c) => c.playerId === pid).at(-1)?.ts;
}

export function normalizeChat(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function activePlayers(s: RoomState) {
  return s.players.filter((p) => p.status === "active");
}

function getPlayer(s: RoomState, id: string) {
  return s.players.find((p) => p.id === id);
}

function name(s: RoomState, id: string | null) {
  return (id && getPlayer(s, id)?.name) || "Someone";
}

function addEvent(s: RoomState, text: string, now: number, to?: string) {
  s.seq += 1;
  s.events = [...s.events, { id: s.seq, ts: now, text, to }].slice(-40);
}

/** Next active player after `id` in seat order (wraps). `id` may be a non-active seat. */
export function nextActive(s: RoomState, id: string): string | null {
  const seats = s.players;
  const idx = seats.findIndex((p) => p.id === id);
  if (idx < 0) return activePlayers(s)[0]?.id ?? null;
  for (let i = 1; i <= seats.length; i++) {
    const p = seats[(idx + i) % seats.length];
    if (p.status === "active" && p.id !== id) return p.id;
  }
  return null;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isWinningHand(hand: Card[] | undefined) {
  return !!hand && hand.length === 3 && hand.every((c) => c.owner === hand[0].owner);
}

export function createRoomState(code: string, host: Player, now: number): RoomState {
  return {
    code,
    hostId: host.id,
    phase: "lobby",
    players: [host],
    hands: {},
    turnId: null,
    firstId: null,
    passes: 0,
    round1Done: false,
    lastPass: null,
    winnerId: null,
    boost: null,
    round: 0,
    events: [{ id: 1, ts: now, text: `${host.name} created the room` }],
    seq: 1,
  };
}

export function addPlayer(s: RoomState, p: Player, now: number): RoomState {
  s = structuredClone(s);
  const canPlay = s.phase === "lobby" && activePlayers(s).length < MAX_ACTIVE;
  p.status = canPlay ? "active" : "spectator";
  s.players.push(p);
  if (!getPlayer(s, s.hostId)) s.hostId = p.id;
  addEvent(s, `${p.name} joined${p.status === "spectator" ? " as a spectator" : ""}`, now);
  return s;
}

function promoteSpectators(s: RoomState, now: number) {
  for (const p of s.players) {
    if (p.status === "spectator" && activePlayers(s).length < MAX_ACTIVE) {
      p.status = "active";
      p.ready = false;
      addEvent(s, `${p.name} is now an active player`, now);
    }
  }
}

function toLobby(s: RoomState, now: number) {
  s.pendingSwap = null;
  s.signals = {};
  s.phase = "lobby";
  s.hands = {};
  s.turnId = null;
  s.firstId = null;
  s.passes = 0;
  s.round1Done = false;
  s.lastPass = null;
  s.boost = null;
  s.winnerId = null;
  for (const p of s.players) p.ready = false;
  promoteSpectators(s, now);
}

export function dealRound(s: RoomState, now: number, rand: () => number = Math.random) {
  s.pendingSwap = null;
  s.signals = {};
  promoteSpectators(s, now);
  const actives = activePlayers(s);
  if (actives.length < MIN_ACTIVE) {
    toLobby(s, now);
    return;
  }
  s.rewards = null;
  s.chat = [];
  s.reactions = [];
  s.round += 1;
  const deck = shuffle(
    actives.flatMap((p) =>
      [0, 1, 2].map((i) => ({ id: `${s.round}-${p.id}-${i}`, owner: p.id })),
    ),
    rand,
  );
  s.hands = {};
  actives.forEach((p, i) => (s.hands[p.id] = deck.slice(i * 3, i * 3 + 3)));
  s.phase = "playing";
  s.firstId = actives[0].id;
  s.turnId = actives[0].id;
  s.passes = 0;
  s.round1Done = false;
  s.lastPass = null;
  s.winnerId = null;
  s.boost = null;
}

function finalizeBoost(s: RoomState, now: number) {
  const b = s.boost;
  if (!b) return;
  const entries = b.participants.flatMap((pid) => {
    const p = getPlayer(s, pid);
    if (!p) return [];
    const rank = b.order.indexOf(pid);
    const earned = rank < 0 ? 0 : b.participants.length - rank;
    const bonus = s.winnerId === pid ? 2 : 0;
    const before = p.score;
    p.score += earned + bonus;
    return [{ playerId: pid, earned, bonus, before, total: p.score }];
  });
  s.rewards = { round: s.round, winnerId: s.winnerId, entries };
  addEvent(s, `Boost results: ${entries.map(e => `${name(s, e.playerId)} +${e.earned + e.bonus}`).join(", ")}`, now);
  toLobby(s, now);
}

/** Remove a player (left or timed out) without breaking the round. */
export function removePlayer(s: RoomState, pid: string, now: number, reason: string) {
  const p = getPlayer(s, pid);
  if (!p) return;
  const wasActive = p.status === "active";
  const nextAfter = nextActive(s, pid);
  if (s.pendingSwap && (wasActive || s.pendingSwap.attacker === pid || s.pendingSwap.defender === pid)) {
    addEvent(s, "The pending Wild Swap was cancelled because a player left.", now);
    s.pendingSwap = null;
  }
  if (s.signals) delete s.signals[pid];

  if (s.phase === "playing" && wasActive) {
    const pool: Card[] = (s.hands[pid] ?? []).filter((c) => c.owner !== pid);
    delete s.hands[pid];
    for (const id of Object.keys(s.hands)) {
      s.hands[id] = s.hands[id].filter((c) => c.owner !== pid);
    }
    s.players = s.players.filter((x) => x.id !== pid);
    const actives = activePlayers(s);
    for (const a of actives) {
      const h = s.hands[a.id] ?? [];
      while (h.length > 3) { const card = h.pop(); if (card) pool.push(card); };
      s.hands[a.id] = h;
    }
    for (const a of actives) {
      const h = s.hands[a.id];
      while (h.length < 3 && pool.length) { const card = pool.shift(); if (card) h.push(card); };
    }
    addEvent(s, `${p.name} ${reason}. Cards were redistributed.`, now);
    if (actives.length < MIN_ACTIVE) {
      addEvent(s, "Not enough players — round ended", now);
      toLobby(s, now);
    } else {
      if (s.turnId === pid || !s.turnId || !getPlayer(s, s.turnId)) s.turnId = nextAfter;
      // Everyone now holds exactly 3 cards; the current turn holder starts a fresh pass cycle.
      s.firstId = s.turnId;
      if (!s.round1Done) s.passes = 0;
      s.lastPass = null;
    }
  } else {
    s.players = s.players.filter((x) => x.id !== pid);
    addEvent(s, `${p.name} ${reason}`, now);
    if (s.phase === "boost" && s.boost) {
      s.boost.participants = s.boost.participants.filter((x) => x !== pid);
      s.boost.order = s.boost.order.filter((x) => x !== pid);
      if (s.boost.order.length >= s.boost.participants.length) finalizeBoost(s, now);
    }
  }

  if (s.hostId === pid && s.players.length) {
    const nh = activePlayers(s)[0] ?? s.players[0];
    s.hostId = nh.id;
    addEvent(s, `${nh.name} is now the host`, now);
  }
}

/** Time-based housekeeping: disconnect timeouts and boost timeout. */
export function sweep(s: RoomState, now: number) {
  for (const p of [...s.players]) {
    if (now - p.lastSeen >= DISCONNECT_MS) removePlayer(s, p.id, now, "left the room (disconnected)");
  }
  if (s.phase === "boost" && s.boost && now - s.boost.startedAt > BOOST_TIMEOUT_MS) {
    finalizeBoost(s, now);
  }
}

export function applyAction(
  input: RoomState,
  pid: string,
  action: Action,
  now: number,
  rand: () => number = Math.random,
): RoomState {
  const s = structuredClone(input);
  sweep(s, now);
  const me = getPlayer(s, pid) ?? fail("You are not in this room");
  me.lastSeen = now;
  if (s.pendingSwap && ["pass", "swap", "victory"].includes(action.type)) fail("Waiting for the Wild Swap defence response");

  switch (action.type) {
    case "heartbeat":
      break;
    case "signal": {
      if (s.phase === "lobby") fail("Reactions are only available during gameplay");
      const isReaction = REACTIONS.some(text => text === action.text);
      if (!isReaction && !QUICK_CHAT.some(text => text === action.text)) fail("Unknown reaction or message");
      // Reactions and chat are rate-limited separately so a quick emoji right after a message still lands.
      const last = isReaction ? lastReactionTs(s, pid) : lastChatTs(s, pid);
      if (last !== undefined && now - last < 800) fail(isReaction ? "Wait a moment before reacting again" : "Wait a moment before sending again");
      s.signals = { ...s.signals, [pid]: { text: action.text, ts: now } };
      s.socialSeq = (s.socialSeq ?? 0) + 1;
      if (isReaction) {
        s.reactions = [...(s.reactions ?? []).filter(r => now - r.ts < SIGNAL_MS * 2), { id: s.socialSeq, playerId: pid, text: action.text, ts: now }].slice(-30);
      } else {
        s.chat = [...(s.chat ?? []), { id: s.socialSeq, playerId: pid, name: me.name, text: action.text, ts: now, custom: false }].slice(-100);
      }
      break;
    }
    case "chat": {
      if (s.phase === "lobby") fail("Chat is only available during gameplay");
      if (me.status === "spectator") fail("Spectators can only send quick messages and reactions");
      const text = normalizeChat(action.text);
      if (!text) fail("Type a message first");
      if (text.length > CHAT_MAX) fail(`Messages can be at most ${CHAT_MAX} characters`);
      const lastChat = lastChatTs(s, pid);
      if (lastChat !== undefined && now - lastChat < 800) fail("Wait a moment before sending again");
      s.signals = { ...s.signals, [pid]: { text, ts: now } };
      s.socialSeq = (s.socialSeq ?? 0) + 1;
      s.chat = [...(s.chat ?? []), { id: s.socialSeq, playerId: pid, name: me.name, text, ts: now, custom: true }].slice(-100);
      break;
    }
    case "endGame": {
      if (s.hostId !== pid) fail("Only the host can end the game");
      if (s.phase !== "lobby") fail("End the round first, then end the game from the lobby");
      if (s.round === 0) fail("Play at least one round before ending the game");
      const winners = finalWinners(s.players);
      s.final = {
        endedAt: now,
        winners,
        standings: [...s.players].sort((a, b) => b.score - a.score).map(p => ({ playerId: p.id, name: p.name, score: p.score })),
      };
      s.phase = "finished";
      s.rewards = null;
      s.reactions = [];
      for (const p of s.players) p.ready = false;
      addEvent(s, `The host ended the game! ${winners.map(id => name(s, id)).join(" & ")} ${winners.length > 1 ? "win" : "wins"}!`, now);
      break;
    }
    case "newGame": {
      const ended = s.phase === "finished" ? s.final : null;
      if (!ended) return fail("This game has already been reset");
      if (now - ended.endedAt < CELEBRATION_MS - 1000) fail("Let the celebration finish first");
      for (const p of s.players) {
        p.score = 0;
        p.swapsUsed = 0;
        p.swapsClaimed = 0;
      }
      s.round = 0;
      s.rewards = null;
      s.final = null;
      s.chat = [];
      s.reactions = [];
      toLobby(s, now);
      addEvent(s, `${me.name} started a new game. Back to the lobby!`, now);
      break;
    }
    case "ready":
      if (s.phase !== "lobby") fail("Game already running");
      me.ready = action.ready;
      break;
    case "start": {
      if (s.hostId !== pid) fail("Only the host can start");
      if (s.phase !== "lobby") fail("Game already running");
      const actives = activePlayers(s);
      if (actives.length < MIN_ACTIVE) fail("Need at least 2 players");
      if (actives.some((p) => p.id !== pid && !p.ready)) fail("Not everyone is ready");
      dealRound(s, now, rand);
      addEvent(s, `Round ${s.round} started`, now);
      break;
    }
    case "pass": {
      if (s.phase !== "playing") fail("Not in play");
      if (s.turnId !== pid) fail("Not your turn");
      if (action.round !== s.round || action.passes !== s.passes) fail("This turn has already changed");
      const hand = s.hands[pid] ?? [];
      const idx = hand.findIndex((c) => c.id === action.cardId);
      if (idx < 0) fail("You don't hold that card");
      const to = nextActive(s, pid) ?? fail("No one to pass to");
      const [card] = hand.splice(idx, 1);
      s.hands[to].push(card);
      s.passes += 1;
      s.lastPass = { from: pid, to, cardId: card.id, swapped: false };
      s.turnId = to;
      if (!s.round1Done && to === s.firstId && s.passes >= activePlayers(s).length) {
        s.round1Done = true;
        addEvent(s, "Round 1 complete — Victory is unlocked!", now);
      }
      break;
    }
    case "claimSwap": {
      if (s.phase === "finished") fail("The game is over");
      const claimed = me.swapsClaimed ?? me.swapsUsed;
      if (action.claimNumber !== claimed + 1) fail("This power has already been claimed");
      if (swapsClaimable(me) < 1) fail("Not enough BoostyBuns to claim a Wild Swap yet");
      me.swapsClaimed = claimed + 1;
      break;
    }
    case "swap": {
      if (s.phase !== "playing") fail("Not in play");
      const lp = s.lastPass ?? fail("You can only swap the card you just received");
      if (lp.to !== pid || s.turnId !== pid) fail("You can only swap the card you just received");
      if (lp.swapped) fail("Already swapped this card");
      if (swapsAvailable(me) < 1) fail("No Wild Swaps available");
      const myHand = s.hands[pid] ?? [];
      const senderHand = s.hands[lp.from] ?? fail("Sender is gone");
      const ri = myHand.findIndex((c) => c.id === lp.cardId);
      if (ri < 0 || senderHand.length === 0) fail("Invalid card");
      me.swapsUsed += 1;
      lp.swapped = true;
      s.swapSequence = (s.swapSequence ?? 0) + 1;
      s.pendingSwap = { id: s.swapSequence, attacker: pid, defender: lp.from, cardId: lp.cardId };
      addEvent(s, `${me.name} used a Wild Swap on ${name(s, lp.from)}`, now);
      break;
    }
    case "respondSwap": {
      const incoming = s.pendingSwap ?? fail("This Wild Swap has already been resolved");
      if (incoming.id !== action.swapId || incoming.defender !== pid) fail("This is not your incoming Wild Swap");
      if (s.phase !== "playing") fail("Not in play");
      if (action.defend && swapsAvailable(me) > 0) {
        me.swapsUsed += 1;
        addEvent(s, `${me.name} defended the Wild Swap — no cards exchanged!`, now, incoming.attacker);
        addEvent(s, "You defended the Wild Swap — no cards exchanged!", now, pid);
      } else {
        const attackingHand = s.hands[incoming.attacker] ?? fail("Attacker is gone");
        const defendingHand = s.hands[pid] ?? fail("Defender is gone");
        const ri = attackingHand.findIndex(c => c.id === incoming.cardId);
        if (ri < 0 || !defendingHand.length) fail("Invalid card");
        const ti = Math.floor(rand() * defendingHand.length);
        [attackingHand[ri], defendingHand[ti]] = [defendingHand[ti], attackingHand[ri]];
        if (s.lastPass) s.lastPass.cardId = attackingHand[ri].id;
        addEvent(s, `${name(s, incoming.attacker)} randomly swapped one of your cards with Wild Swap!`, now, pid);
        if (action.defend) addEvent(s, "You don't have enough Wild Swap powers to defend!", now, pid);
      }
      s.pendingSwap = null;
      break;
    }
    case "victory": {
      if (s.phase !== "playing") fail("Victory already claimed or not in play");
      if (me.status !== "active") fail("Spectators can't claim");
      if (!s.round1Done) fail("Victory unlocks after Round 1");
      if (!isWinningHand(s.hands[pid])) fail("You need exactly 3 matching cards (pass your 4th card first)");
      s.phase = "boost";
      s.winnerId = pid;
      s.boost = { order: [], startedAt: now, participants: activePlayers(s).map((p) => p.id) };
      addEvent(s, `${me.name} claimed VICTORY! BOOST NOW!`, now);
      break;
    }
    case "boost": {
      if (s.phase !== "boost") fail("No boost right now");
      const boost = s.boost ?? fail("No boost right now");
      if (!boost.participants.includes(pid)) fail("You're not in this boost");
      if (boost.order.includes(pid)) fail("Already boosted");
      boost.order.push(pid);
      if (boost.order.length >= boost.participants.length) finalizeBoost(s, now);
      break;
    }
    case "endRound": {
      if (s.hostId !== pid) fail("Only the host can end the round");
      if (s.phase === "lobby" || s.phase === "finished") fail("No round in progress");
      addEvent(s, "The host ended the round. Back to the lobby.", now);
      toLobby(s, now);
      break;
    }
    case "leave":
      removePlayer(s, pid, now, "left the room");
      break;
  }
  sweep(s, now);
  return s;
}
