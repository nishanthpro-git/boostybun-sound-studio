import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { roomAction } from "@/lib/room.functions";
import { DISCONNECT_MS } from "@/lib/game";
import type { Session } from "@/lib/session";

/** Successful server heartbeats, not WebSocket presence, own the reconnect deadline. */
export function useRoomConnection(session: Session | null) {
  const heartbeat = useServerFn(roomAction);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    let checking = false;
    const key = `bb_last_ack_${session.code}_${session.playerId}`;
    let lastAck = Number(sessionStorage.getItem(key)) || Date.now();
    const disconnected = () => { if (alive) setDeadline(lastAck + DISCONNECT_MS); };
    const check = async () => {
      if (checking) return;
      if (!navigator.onLine) { disconnected(); return; }
      checking = true;
      const timeout = setTimeout(disconnected, 5000);
      try {
        const result = await heartbeat({ data: { ...session, action: { type: "heartbeat" } } });
        if (!alive) return;
        if ("error" in result && result.error) {
          if (result.error === "You are no longer in this room" || result.error === "Room not found") setExpired(true);
          else disconnected();
        } else {
          lastAck = Date.now();
          sessionStorage.setItem(key, String(lastAck));
          setDeadline(null);
        }
      } catch { disconnected(); }
      finally { clearTimeout(timeout); checking = false; }
    };
    void check();
    const interval = setInterval(check, 2000);
    window.addEventListener("offline", disconnected);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
    };
  }, [session, heartbeat]);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline]);
  return { disconnected: deadline !== null, seconds, expired };
}