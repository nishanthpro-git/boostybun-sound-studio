import { describe, expect, it } from "vitest";
import { CELEBRATION_MS, disconnectedPlayers, DISCONNECT_MS, REACTIONS, QUICK_CHAT, swapThreshold, swapsEarned, addPlayer, applyAction, createRoomState, swapsAvailable, swapsClaimable, sweep, type Player, type RoomState } from "./game";

const now = 1_000_000;
const mk = (id: string): Player => ({
  id, name: id, avatar: "🐰", tokenHash: "", ready: true, lastSeen: now, score: 0, swapsUsed: 0, status: "active",
});
function room(n: number): RoomState {
  let s = createRoomState("ABCDEF", mk("p0"), now);
  for (let i = 1; i < n; i++) s = addPlayer(s, mk(`p${i}`), now);
  return applyAction(s, "p0", { type: "start" }, now);
}

describe("BoostyBun rules", () => {
  it.each(["playing", "boost"] as const)("host ends %s to the lobby and waits for an explicit start", (phase) => {
    let s = room(3);
    s.phase = phase;
    if (phase === "boost") s.boost = { order: [], startedAt: now, participants: ["p0", "p1", "p2"] };
    s = applyAction(s, "p0", { type: "endRound" }, now);
    expect(s.phase).toBe("lobby");
    expect(s.round).toBe(1);
    expect(s.hands).toEqual({});
    expect(s.turnId).toBeNull();
    expect(s.boost).toBeNull();
    expect(s.players.every(p => !p.ready)).toBe(true);
    s = addPlayer(s, mk("p3"), now);
    expect(s.players.find(p => p.id === "p3")?.status).toBe("active");
    s = applyAction(s, "p0", { type: "heartbeat" }, now + 4000);
    expect(s.phase).toBe("lobby");
    expect(s.round).toBe(1);
    for (const pid of ["p1", "p2", "p3"]) s = applyAction(s, pid, { type: "ready", ready: true }, now + 4000);
    s = applyAction(s, "p0", { type: "start" }, now + 4000);
    expect(s.phase).toBe("playing");
    expect(s.round).toBe(2);
    expect(Object.values(s.hands).map(hand => hand.length)).toEqual([3, 3, 3, 3]);
  });

  it("deals 3 cards to each player", () => {
    const s = room(4);
    for (const p of s.players) expect(s.hands[p.id]).toHaveLength(3);
  });

  it("locks victory until round 1 completes, then unlocks it", () => {
    let s = room(3);
    expect(() => applyAction(s, "p0", { type: "victory" }, now)).toThrow();
    for (let i = 0; i < 3; i++) s = applyAction(s, s.turnId ?? "", { type: "pass", cardId: s.hands[s.turnId ?? ""][0].id, round: s.round, passes: s.passes }, now);
    expect(s.round1Done).toBe(true);
    expect(s.turnId).toBe("p0");
    for (const p of s.players) expect(s.hands[p.id]).toHaveLength(3);
  });

  it("rejects passing out of turn", () => {
    const s = room(3);
    expect(() => applyAction(s, "p1", { type: "pass", cardId: s.hands["p1"][0].id, round: s.round, passes: s.passes }, now)).toThrow();
  });

  it("scores boost N..1 plus +2 for the winner", () => {
    let s = room(3);
    s = { ...s, round1Done: true, hands: { ...s.hands, p1: [{ id: "a", owner: "p0" }, { id: "b", owner: "p0" }, { id: "c", owner: "p0" }] } };
    s = applyAction(s, "p1", { type: "victory" }, now);
    expect(() => applyAction(s, "p2", { type: "victory" }, now)).toThrow();
    s = applyAction(s, "p2", { type: "boost" }, now);
    s = applyAction(s, "p1", { type: "boost" }, now);
    s = applyAction(s, "p0", { type: "boost" }, now);
    const score = (id: string) => s.players.find((p) => p.id === id)?.score;
    expect([score("p2"), score("p1"), score("p0")]).toEqual([3, 2 + 2, 1]);
  });

  it("requires manually claiming every power earned at 5, 10, then 15 BoostyBuns", () => {
    let s = room(3);
    s.players[0].score = 15;
    expect(swapsAvailable(s.players[0])).toBe(0);
    expect(swapsClaimable(s.players[0])).toBe(2);
    s = applyAction(s, "p0", { type: "claimSwap", claimNumber: 1 }, now);
    expect(swapsAvailable(s.players[0])).toBe(1);
    expect(swapsClaimable(s.players[0])).toBe(1);
    expect(s.players[0].score).toBe(15);
    expect(() => applyAction(s, "p0", { type: "claimSwap", claimNumber: 1 }, now)).toThrow();
    s = applyAction(s, "p0", { type: "claimSwap", claimNumber: 2 }, now);
    expect(swapsAvailable(s.players[0])).toBe(2);
    expect(swapsClaimable(s.players[0])).toBe(0);
    expect(() => applyAction(s, "p0", { type: "claimSwap", claimNumber: 3 }, now)).toThrow();
  });

  it("preserves unclaimed powers across rounds and rejects claims below 5", () => {
    let s = room(3);
    s.players[0].score = 4;
    expect(() => applyAction(s, "p0", { type: "claimSwap", claimNumber: 1 }, now)).toThrow();
    s.players[0].score = 5;
    s = applyAction(s, "p0", { type: "endRound" }, now);
    expect(swapsClaimable(s.players[0])).toBe(1);
    expect(s.players[0].score).toBe(5);
  });

  it("randomly swaps a sender card, consumes exactly one claimed power, and preserves scores", () => {
    let s = room(3);
    s.players[1].score = 6;
    s = applyAction(s, "p1", { type: "claimSwap", claimNumber: 1 }, now);
    const received = s.hands["p0"][0];
    s = applyAction(s, "p0", { type: "pass", cardId: received.id, round: s.round, passes: s.passes }, now);
    const chosen = s.hands["p0"][1];
    s = applyAction(s, "p1", { type: "swap" }, now, () => 0.75);
    expect(s.hands["p1"].some(c => c.id === received.id)).toBe(true);
    s = applyAction(s, "p0", { type: "respondSwap", swapId: s.pendingSwap?.id ?? 0, defend: false }, now, () => 0.75);
    expect(s.hands["p1"].some(c => c.id === chosen.id)).toBe(true);
    expect(s.hands["p0"].some(c => c.id === received.id)).toBe(true);
    expect(s.hands["p1"]).toHaveLength(4);
    expect(s.hands["p0"]).toHaveLength(2);
    expect(s.lastPass?.cardId).toBe(chosen.id);
    expect(s.players[1].swapsUsed).toBe(1);
    expect(swapsAvailable(s.players[1])).toBe(0);
    expect(s.players[1].score).toBe(6);
    expect(s.events.some(e => e.to === "p0")).toBe(true);
    expect(() => applyAction(s, "p1", { type: "swap" }, now)).toThrow();
  });

  it("does not allow swaps using unclaimed powers", () => {
    let s = room(3);
    s.players[1].score = 6;
    s = applyAction(s, "p0", { type: "pass", cardId: s.hands["p0"][0].id, round: s.round, passes: s.passes }, now);
    expect(() => applyAction(s, "p1", { type: "swap" }, now)).toThrow();
  });

  it("rejects duplicate pass even after the turn returns", () => {
    let s = room(3);
    const pass = { type: "pass" as const, cardId: s.hands["p0"][0].id, round: s.round, passes: s.passes };
    s = applyAction(s, "p0", pass, now);
    expect(() => applyAction(s, "p0", pass, now)).toThrow();
    for (const pid of ["p1", "p2"]) s = applyAction(s, pid, { type: "pass", cardId: pass.cardId, round: s.round, passes: s.passes }, now);
    expect(() => applyAction(s, "p0", pass, now)).toThrow();
  });

  it("records each round reward and the winner's +2 bonus with before/after totals", () => {
    let s = room(3);
    s.round1Done = true;
    s.hands["p1"] = ["a", "b", "c"].map(id => ({ id, owner: "p1" }));
    s.players[1].score = 5;
    s = applyAction(s, "p1", { type: "victory" }, now);
    for (const pid of ["p2", "p1", "p0"]) s = applyAction(s, pid, { type: "boost" }, now);
    expect(s.phase).toBe("lobby");
    expect(s.rewards?.entries.find(e => e.playerId === "p1")).toEqual({ playerId: "p1", earned: 2, bonus: 2, before: 5, total: 9 });
    expect(s.rewards?.entries.map(e => e.earned)).toEqual([1, 2, 3]);
    expect(s.rewards?.winnerId).toBe("p1");
  });

  it("keeps 3 cards each after a player disconnects", () => {
    const s = room(4);
    const stale = { ...s, players: s.players.map((p) => (p.id === "p2" ? { ...p, lastSeen: 0 } : p)) };
    const out = applyAction(stale, "p0", { type: "heartbeat" }, now);
    expect(out.players.map((p) => p.id)).toEqual(["p0", "p1", "p3"]);
    for (const p of out.players) {
      expect(out.hands[p.id]).toHaveLength(3);
      expect(out.hands[p.id].some((c) => c.owner === "p2")).toBe(false);
    }
  });
});

describe("reconnect grace", () => {
  it("uses 60 seconds and preserves session and cards before expiry", () => {
    expect(DISCONNECT_MS).toBe(60_000);
    const s = room(3);
    const out = applyAction(s, "p1", { type: "heartbeat" }, now + 59_999);
    expect(out.players.map(p => p.id)).toEqual(["p0", "p1", "p2"]);
    expect(out.hands).toEqual(s.hands);
    expect(out.players[1].lastSeen).toBe(now + 59_999);
  });
  it("safely removes expired players at 60 seconds and rejects resurrection", () => {
    const s = room(3);
    s.players[0].lastSeen = now + 60_000;
    s.players[2].lastSeen = now + 60_000;
    expect(() => applyAction(s, "p1", { type: "heartbeat" }, now + 60_000)).toThrow("not in this room");
    sweep(s, now + 60_000);
    expect(s.players.map(p => p.id)).toEqual(["p0", "p2"]);
    expect(Object.values(s.hands).map(h => h.length)).toEqual([3, 3]);
  });
  it("starts a fresh grace period after every successful reconnect", () => {
    let s = room(3);
    for (const elapsed of [59_000, 118_000, 177_000]) {
      for (const p of s.players) p.lastSeen = elapsed + now - 59_000;
      s = applyAction(s, "p1", { type: "heartbeat" }, now + elapsed);
      expect(s.players.some(p => p.id === "p1")).toBe(true);
      expect(s.players[1].lastSeen).toBe(now + elapsed);
    }
  });
});

function attack(defenderPowers = 1) {
  let s = room(3);
  s.players[0].score = 15;
  s.players[0].swapsClaimed = defenderPowers;
  s.players[1].score = 15;
  s.players[1].swapsClaimed = 2;
  s = applyAction(s, "p0", { type: "pass", cardId: s.hands['p0'][0].id, round: s.round, passes: s.passes }, now);
  return applyAction(s, "p1", { type: "swap" }, now);
}

describe("Wild Swap defence", () => {
  it("charges the attacker immediately without exchanging cards until a decision", () => {
    const s = attack();
    expect(s.players[1].swapsUsed).toBe(1);
    expect(s.pendingSwap?.defender).toBe("p0");
    expect(s.hands['p1'].some(c => c.id === s.pendingSwap?.cardId)).toBe(true);
    expect(Object.values(s.hands).map(h => h.length)).toEqual([2, 4, 3]);
  });
  it("defends with exactly one power and no card loss or score changes", () => {
    const s = attack();
    const out = applyAction(s, "p0", { type: "respondSwap", swapId: s.pendingSwap?.id ?? 0, defend: true }, now);
    expect(out.hands).toEqual(s.hands);
    expect(out.players.map(p => p.score)).toEqual([15, 15, 0]);
    expect(out.players.map(p => p.swapsUsed)).toEqual([1, 1, 0]);
    expect(out.players.map(p => p.swapsClaimed)).toEqual([1, 2, undefined]);
    expect(out.pendingSwap).toBeNull();
    expect(out.events.filter(e => e.text.includes("defended")).map(e => e.to)).toEqual(["p1", "p0"]);
  });
  it("accepts OK and uses server randomness to exchange only the two cards", () => {
    const s = attack();
    const chosen = s.hands['p0'][1].id;
    const out = applyAction(s, "p0", { type: "respondSwap", swapId: s.pendingSwap?.id ?? 0, defend: false }, now, () => 0.75);
    expect(out.hands['p1'].some(c => c.id === chosen)).toBe(true);
    expect(out.hands['p0'].some(c => c.id === s.pendingSwap?.cardId)).toBe(true);
    expect(out.players.map(p => p.swapsUsed)).toEqual([0, 1, 0]);
  });
  it("proceeds normally when an unavailable defence is attempted", () => {
    const s = attack(0);
    const out = applyAction(s, "p0", { type: "respondSwap", swapId: s.pendingSwap?.id ?? 0, defend: true }, now, () => 0);
    expect(out.hands).not.toEqual(s.hands);
    expect(out.players[0].swapsUsed).toBe(0);
    expect(out.events.some(e => e.text === "You don't have enough Wild Swap powers to defend!")).toBe(true);
  });
  it("rejects duplicate, stale and another player's responses", () => {
    const s = attack();
    const response = { type: "respondSwap" as const, swapId: s.pendingSwap?.id ?? 0, defend: true };
    expect(() => applyAction(s, "p2", response, now)).toThrow();
    expect(() => applyAction(s, "p0", { ...response, swapId: response.swapId + 1 }, now)).toThrow();
    const out = applyAction(s, "p0", response, now);
    expect(() => applyAction(out, "p0", response, now)).toThrow();
  });
  it("pauses passes, swaps and victories but not reactions", () => {
    const s = attack();
    expect(() => applyAction(s, "p1", { type: "pass", cardId: s.hands['p1'][0].id, round: s.round, passes: s.passes }, now)).toThrow("Waiting");
    expect(() => applyAction(s, "p1", { type: "swap" }, now)).toThrow("Waiting");
    expect(() => applyAction(s, "p2", { type: "victory" }, now)).toThrow("Waiting");
    expect(applyAction(s, "p2", { type: "signal", text: "😂" }, now).pendingSwap).toEqual(s.pendingSwap);
  });
  it("clears pending requests when the defender leaves safely", () => {
    const out = applyAction(attack(), "p0", { type: "leave" }, now);
    expect(out.pendingSwap).toBeNull();
    expect(out.players.map(p => p.id)).toEqual(["p1", "p2"]);
    expect(Object.values(out.hands).map(h => h.length)).toEqual([3, 3]);
  });
});

describe("live social signals", () => {
  it.each([...REACTIONS, ...QUICK_CHAT])("shares predefined signal %s without changing gameplay", text => {
    const s = room(3);
    const out = applyAction(s, "p1", { type: "signal", text }, now);
    expect(out.signals?.['p1']).toEqual({ text, ts: now });
    expect(out.hands).toEqual(s.hands);
    expect(out.turnId).toBe(s.turnId);
    expect(out.passes).toBe(s.passes);
    expect(out.players.map(p => [p.score, p.swapsUsed])).toEqual(s.players.map(p => [p.score, p.swapsUsed]));
  });
  it("rejects arbitrary chat and limits repeated sends", () => {
    let s = room(3);
    expect(() => applyAction(s, "p1", { type: "signal", text: "custom text" }, now)).toThrow();
    s = applyAction(s, "p1", { type: "signal", text: "😂" }, now);
    expect(() => applyAction(s, "p1", { type: "signal", text: "😭" }, now + 799)).toThrow();
    expect(applyAction(s, "p1", { type: "signal", text: "😭" }, now + 800).signals?.['p1'].text).toBe("😭");
  });
  it("includes and removes spectators with the existing shared room state", () => {
    let s = addPlayer(room(3), mk("watcher"), now);
    expect(s.players.filter(p => p.status === "spectator")).toHaveLength(1);
    s = applyAction(s, "watcher", { type: "signal", text: "👀" }, now);
    expect(s.signals?.['watcher'].text).toBe("👀");
    s = applyAction(s, "watcher", { type: "leave" }, now);
    expect(s.players.filter(p => p.status === "spectator")).toHaveLength(0);
  });
});

describe("wild swap costs", () => {
  it("costs 5, then 10, then 15 BoostyBuns, capped at 15", () => {
    expect([1, 2, 3, 4, 5].map(swapThreshold)).toEqual([5, 15, 30, 45, 60]);
    expect(swapsEarned(4)).toBe(0);
    expect(swapsEarned(5)).toBe(1);
    expect(swapsEarned(14)).toBe(1);
    expect(swapsEarned(15)).toBe(2);
    expect(swapsEarned(30)).toBe(3);
    expect(swapsEarned(45)).toBe(4);
  });
});

describe("chat panel rules", () => {
  it("accepts custom messages up to 50 characters and rejects 51", () => {
    const s = room(2);
    const ok = applyAction(s, "p1", { type: "chat", text: "x".repeat(50) }, now);
    expect(ok.chat?.at(-1)).toMatchObject({ playerId: "p1", text: "x".repeat(50), custom: true });
    expect(() => applyAction(s, "p1", { type: "chat", text: "x".repeat(51) }, now)).toThrow();
  });

  it("lets spectators send quick messages and reactions but not custom messages", () => {
    let s = addPlayer(room(2), mk("watcher"), now);
    expect(s.players.find(p => p.id === "watcher")?.status).toBe("spectator");
    expect(() => applyAction(s, "watcher", { type: "chat", text: "hello" }, now)).toThrow();
    s = applyAction(s, "watcher", { type: "signal", text: QUICK_CHAT[0] }, now);
    expect(s.chat?.at(-1)).toMatchObject({ playerId: "watcher", text: QUICK_CHAT[0], custom: false });
    s = applyAction(s, "watcher", { type: "signal", text: "🔥" }, now + 1000);
    expect(s.reactions?.at(-1)).toMatchObject({ playerId: "watcher", text: "🔥" });
  });

  it("keeps quick and custom messages in order but never stores reactions in chat history", () => {
    let s = room(2);
    s = applyAction(s, "p0", { type: "signal", text: QUICK_CHAT[1] }, now);
    s = applyAction(s, "p1", { type: "signal", text: "😂" }, now);
    s = applyAction(s, "p1", { type: "chat", text: "  my   turn soon " }, now + 1000);
    expect(s.chat?.map(c => c.text)).toEqual([QUICK_CHAT[1], "my turn soon"]);
    expect(s.chat?.some(c => c.text === "😂")).toBe(false);
    expect(s.reactions?.map(r => r.text)).toEqual(["😂"]);
  });

  it("clears chat history when a new round begins", () => {
    let s = room(2);
    s = applyAction(s, "p1", { type: "chat", text: "round one chat" }, now);
    s = applyAction(s, "p0", { type: "endRound" }, now);
    expect(s.chat).toHaveLength(1);
    s = applyAction(s, "p1", { type: "ready", ready: true }, now);
    s = applyAction(s, "p0", { type: "start" }, now);
    expect(s.round).toBe(2);
    expect(s.chat).toEqual([]);
  });
});

describe("global disconnect countdown", () => {
  it("shows everyone the same 60-second deadline from the last server heartbeat", () => {
    const s = room(3);
    s.players[1].lastSeen = now - 10_000;
    const list = disconnectedPlayers(s, now);
    expect(list.map(d => d.player.id)).toEqual(["p1"]);
    expect(list[0].seconds).toBe(50);
    expect(disconnectedPlayers(s, now + 49_500).find(d => d.player.id === "p1")?.seconds).toBe(1);
  });

  it("does not flag players with a recent heartbeat", () => {
    expect(disconnectedPlayers(room(3), now + 2000)).toEqual([]);
  });
});

describe("end game", () => {
  const scored = () => {
    let s = applyAction(room(3), "p0", { type: "endRound" }, now);
    s.players[0].score = 7; s.players[1].score = 12; s.players[2].score = 3;
    s.players[1].swapsClaimed = 1; s.players[1].swapsUsed = 1;
    return s;
  };

  it("only the host can end the game, and only from the lobby", () => {
    const s = scored();
    expect(() => applyAction(s, "p1", { type: "endGame" }, now)).toThrow();
    expect(() => applyAction(room(3), "p0", { type: "endGame" }, now)).toThrow();
    const out = applyAction(s, "p0", { type: "endGame" }, now);
    expect(out.phase).toBe("finished");
    expect(out.final?.winners).toEqual(["p1"]);
    expect(out.final?.standings.map(x => x.score)).toEqual([12, 7, 3]);
  });

  it("crowns joint winners on a tied top score", () => {
    const s = scored();
    s.players[0].score = 12;
    expect(applyAction(s, "p0", { type: "endGame" }, now).final?.winners).toEqual(["p0", "p1"]);
  });

  it("blocks further rounds and gameplay once finished, but allows reactions", () => {
    const s = applyAction(scored(), "p0", { type: "endGame" }, now);
    expect(() => applyAction(s, "p0", { type: "start" }, now)).toThrow();
    expect(() => applyAction(s, "p0", { type: "endRound" }, now)).toThrow();
    expect(() => applyAction(s, "p1", { type: "ready", ready: true }, now)).toThrow();
    expect(applyAction(s, "p2", { type: "signal", text: "❤️" }, now + 1000).reactions?.at(-1)?.text).toBe("❤️");
  });

  it("starts a fresh game after the 10-second celebration, keeping members and avatars", () => {
    const s = applyAction(scored(), "p0", { type: "endGame" }, now);
    expect(() => applyAction(s, "p2", { type: "newGame" }, now + 5000)).toThrow();
    const fresh = applyAction(s, "p2", { type: "newGame" }, now + CELEBRATION_MS);
    expect(fresh.phase).toBe("lobby");
    expect(fresh.round).toBe(0);
    expect(fresh.final).toBeNull();
    expect(fresh.players.map(p => [p.id, p.avatar, p.score, p.swapsUsed, p.swapsClaimed])).toEqual([
      ["p0", "🐰", 0, 0, 0], ["p1", "🐰", 0, 0, 0], ["p2", "🐰", 0, 0, 0],
    ]);
    expect(fresh.hostId).toBe("p0");
  });
});

describe("social rate limits", () => {
  it("lets a reaction land right after a chat message, but limits repeats of the same kind", () => {
    let s = room(2);
    s = applyAction(s, "p1", { type: "chat", text: "hi" }, now);
    s = applyAction(s, "p1", { type: "signal", text: "🔥" }, now + 100);
    expect(s.reactions?.at(-1)?.text).toBe("🔥");
    expect(() => applyAction(s, "p1", { type: "chat", text: "again" }, now + 500)).toThrow();
    expect(() => applyAction(s, "p1", { type: "signal", text: "😂" }, now + 500)).toThrow();
  });
});
