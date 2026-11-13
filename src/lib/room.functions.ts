import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addPlayer,
  applyAction,
  createRoomState,
  GameError,
  sweep,
  type Action,
  type Player,
  type RoomState,
} from "./game";

async function sha(token: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const profile = z.object({
  name: z.string().trim().min(1).max(20),
  avatar: z.string().min(1).max(60000),
  bg: z.number().int().min(0).max(9).optional(),
  mask: z.number().int().min(0).max(4).optional(),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Optimistic read-modify-write with a version check so concurrent actions never corrupt state. */
async function mutate(code: string, fn: (s: RoomState) => RoomState) {
  const db = await admin();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await db.from("rooms").select("state, version").eq("code", code).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { error: "Room not found" as string };
    let next: RoomState;
    try {
      next = fn(data.state as unknown as RoomState);
    } catch (e) {
      if (e instanceof GameError) return { error: e.message };
      throw e;
    }
    const { data: upd, error: uerr } = await db
      .from("rooms")
      .update({ state: next as never, version: data.version + 1, updated_at: new Date().toISOString() })
      .eq("code", code)
      .eq("version", data.version)
      .select("code");
    if (uerr) throw new Error(uerr.message);
    if (upd && upd.length) return { state: next };
  }
  return { error: "Server busy, try again" };
}

function newPlayer(name: string, avatar: string, tokenHash: string, look: { bg?: number; mask?: number } = {}): Player {
  return {
    id: crypto.randomUUID(),
    name,
    avatar,
    ...(look.bg !== undefined && { bg: look.bg }),
    ...(look.mask !== undefined && { mask: look.mask }),
    tokenHash,
    ready: false,
    lastSeen: Date.now(),
    score: 0,
    swapsUsed: 0,
    swapsClaimed: 0,
    status: "active",
  };
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => profile.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const token = crypto.randomUUID();
    const p = newPlayer(data.name, data.avatar, await sha(token), data);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const { error } = await db
        .from("rooms")
        .insert({ code, state: createRoomState(code, p, Date.now()) as never });
      if (!error) return { code, playerId: p.id, token };
    }
    return { error: "Could not create room" };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => profile.extend({ code: z.string().trim().toUpperCase().length(6) }).parse(d))
  .handler(async ({ data }) => {
    const token = crypto.randomUUID();
    const p = newPlayer(data.name, data.avatar, await sha(token), data);
    const res = await mutate(data.code, (s) => { sweep(s, Date.now()); return addPlayer(s, p, Date.now()); });
    if ("error" in res) return { error: res.error };
    return { code: data.code, playerId: p.id, token };
  });

export const roomAction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().length(6),
        playerId: z.string().uuid(),
        token: z.string().min(10),
        action: z.discriminatedUnion("type", [
          z.object({ type: z.literal("ready"), ready: z.boolean() }).strict(),
          z.object({ type: z.literal("pass"), cardId: z.string(), round: z.number().int().nonnegative(), passes: z.number().int().nonnegative() }).strict(),
          z.object({ type: z.literal("claimSwap"), claimNumber: z.number().int().positive() }).strict(),
          z.object({ type: z.literal("respondSwap"), swapId: z.number().int().positive(), defend: z.boolean() }).strict(),
          z.object({ type: z.literal("signal"), text: z.string().max(80) }).strict(),
          z.object({ type: z.literal("chat"), text: z.string().max(200) }).strict(),
          ...["start", "victory", "boost", "swap", "endRound", "endGame", "newGame", "leave", "heartbeat"].map(type => z.object({ type: z.literal(type) }).strict()),
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const hash = await sha(data.token);
    let expired = false;
    const res = await mutate(data.code, (s) => {
      const p = s.players.find((x) => x.id === data.playerId);
      if (!p || p.tokenHash !== hash) throw new GameError("You are no longer in this room");
      sweep(s, Date.now());
      expired = !s.players.some(x => x.id === data.playerId);
      if (expired) return s;
      return applyAction(s, data.playerId, data.action as unknown as Action, Date.now(), () => {
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        return values[0] / 4294967296;
      });
    });
    if ("error" in res) return { error: res.error };
    if (expired) return { error: "You are no longer in this room" };
    return { ok: true };
  });

/** Members-only room read: verifies the player's token and strips secrets before returning. */
export const getRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().length(6), playerId: z.string().uuid(), token: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("rooms")
      .select("state, version, updated_at")
      .eq("code", data.code)
      .maybeSingle();
    if (error) return { error: "Could not load room" };
    if (!row) return { row: null };
    const s = row.state as unknown as RoomState;
    const hash = await sha(data.token);
    const me = s.players.find((x) => x.id === data.playerId);
    if (!me || me.tokenHash !== hash) return { row: null };
    const safe = { ...s, players: s.players.map(({ tokenHash: _t, ...rest }) => ({ ...rest, tokenHash: "" })) };
    return { row: { state: safe as never, version: row.version, updated_at: row.updated_at } };
  });
