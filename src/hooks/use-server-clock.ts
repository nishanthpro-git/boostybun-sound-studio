import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Estimates the server clock from room rows' `updated_at`. A row is never newer than the
 * server's "now", so the largest recent (server - local) sample is the best offset estimate.
 */
export function useServerOffset() {
  const samples = useRef<number[]>([]);
  const [offset, setOffset] = useState(0);
  const record = useCallback((updatedAt: string | null | undefined) => {
    const t = updatedAt ? Date.parse(updatedAt) : NaN;
    if (!Number.isFinite(t)) return;
    samples.current = [...samples.current, t - Date.now()].slice(-20);
    const best = Math.max(...samples.current);
    setOffset((prev) => (Math.abs(prev - best) > 250 ? best : prev));
  }, []);
  return { offset, record };
}

/** Re-renders every `intervalMs` and returns the estimated server time. */
export function useServerNow(offset: number, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(id);
  }, [offset, intervalMs]);
  return now;
}
