// BoostyBun sound effects: tiny synthesized cartoon sounds via Web Audio.
// No files to download, so every sound is instantly "preloaded" and works offline.
import { useSyncExternalStore } from "react";

export type Sfx =
  | "click" | "nav" | "avatar" | "background" | "mask" | "create" | "join"
  | "tap" | "send" | "receive" | "pass" | "turn" | "swap" | "claim" | "reward"
  | "victory" | "confetti" | "error" | "alert" | "boost" | "pop" | "ready" | "start" | "success";

const KEY = "boostybun:sound";
let enabled = true;
let loaded = false;
const listeners = new Set<() => void>();

function readPref() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { enabled = localStorage.getItem(KEY) !== "off"; } catch { /* ignore */ }
}
export function isSoundOn() { readPref(); return enabled; }
export function setSoundOn(on: boolean) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
  listeners.forEach((l) => l());
  if (on) { unlock(); sfx("pop"); }
}
export function useSoundOn() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    isSoundOn,
    () => true,
  );
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}
/** Browsers block audio until a user gesture; resume on the first one. */
export function unlock() {
  const c = audio();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

type Tone = { f: number; to?: number; t?: number; d: number; type?: OscillatorType; v?: number };
function tone(c: AudioContext, { f, to, t = 0, d, type = "sine", v = 0.5 }: Tone) {
  const start = c.currentTime + t;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + d);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(v, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + d);
  o.connect(g).connect(master!);
  o.start(start);
  o.stop(start + d + 0.02);
}
function noise(c: AudioContext, { t = 0, d, v = 0.3, from = 800, to = 3000 }: { t?: number; d: number; v?: number; from?: number; to?: number }) {
  const start = c.currentTime + t;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(from, start);
  bp.frequency.exponentialRampToValueAtTime(to, start + d);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(v, start + d * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, start + d);
  src.connect(bp).connect(g).connect(master!);
  src.start(start);
}
const arp = (c: AudioContext, notes: number[], step: number, d: number, type: OscillatorType = "triangle", v = 0.35) =>
  notes.forEach((f, i) => tone(c, { f, t: i * step, d, type, v }));

const SOUNDS: Record<Sfx, (c: AudioContext) => void> = {
  click: (c) => tone(c, { f: 900, to: 600, d: 0.06, type: "triangle", v: 0.25 }),
  nav: (c) => tone(c, { f: 500, to: 800, d: 0.08, type: "triangle", v: 0.25 }),
  pop: (c) => tone(c, { f: 400, to: 1200, d: 0.09, v: 0.4 }),
  avatar: (c) => { tone(c, { f: 520, to: 900, d: 0.1, type: "square", v: 0.12 }); tone(c, { f: 1040, t: 0.06, d: 0.08, v: 0.2 }); },
  background: (c) => { noise(c, { d: 0.12, v: 0.15, from: 1500, to: 4000 }); tone(c, { f: 700, t: 0.04, d: 0.08, type: "triangle", v: 0.2 }); },
  mask: (c) => tone(c, { f: 300, to: 1400, d: 0.18, type: "sine", v: 0.35 }),
  create: (c) => arp(c, [523, 659, 784, 1047], 0.07, 0.18),
  join: (c) => arp(c, [392, 523, 659], 0.08, 0.2),
  ready: (c) => arp(c, [660, 990], 0.07, 0.12, "triangle", 0.3),
  start: (c) => { arp(c, [392, 523, 659, 784, 1047], 0.08, 0.22, "square", 0.12); noise(c, { d: 0.5, v: 0.1, from: 500, to: 5000 }); },
  tap: (c) => { noise(c, { d: 0.05, v: 0.25, from: 2000, to: 3500 }); tone(c, { f: 1200, d: 0.04, type: "triangle", v: 0.12 }); },
  send: (c) => { noise(c, { d: 0.25, v: 0.35, from: 600, to: 4000 }); tone(c, { f: 400, to: 900, d: 0.2, v: 0.15 }); },
  receive: (c) => { noise(c, { d: 0.22, v: 0.3, from: 3500, to: 700 }); tone(c, { f: 900, t: 0.18, d: 0.08, type: "triangle", v: 0.3 }); tone(c, { f: 1350, t: 0.24, d: 0.1, type: "triangle", v: 0.22 }); },
  pass: (c) => { noise(c, { d: 0.18, v: 0.25, from: 1000, to: 2500 }); tone(c, { f: 600, to: 450, t: 0.05, d: 0.12, type: "triangle", v: 0.2 }); },
  turn: (c) => { tone(c, { f: 1175, d: 0.25, v: 0.25 }); tone(c, { f: 1568, t: 0.1, d: 0.35, v: 0.2 }); },
  swap: (c) => { tone(c, { f: 200, to: 1600, d: 0.45, type: "sawtooth", v: 0.1 }); noise(c, { d: 0.5, v: 0.2, from: 400, to: 6000 }); arp(c, [1047, 1319, 1568, 2093], 0.06, 0.2, "sine", 0.2); },
  claim: (c) => { arp(c, [988, 1319], 0.08, 0.3, "square", 0.12); arp(c, [1568, 1976, 2637], 0.05, 0.25, "sine", 0.18); },
  success: (c) => arp(c, [784, 1047], 0.08, 0.18, "triangle", 0.3),
  reward: (c) => { [0, 0.09, 0.18, 0.27, 0.36].forEach((t, i) => tone(c, { f: 1319 + i * 120, t, d: 0.15, type: "square", v: 0.08 })); arp(c, [523, 784, 1047], 0.12, 0.4, "triangle", 0.25); },
  victory: (c) => { arp(c, [523, 523, 523, 698, 880, 784, 1047], 0.13, 0.3, "square", 0.13); arp(c, [262, 349, 392, 523], 0.22, 0.5, "triangle", 0.25); },
  confetti: (c) => { for (let i = 0; i < 8; i++) tone(c, { f: 1800 + Math.random() * 1600, t: i * 0.05 + Math.random() * 0.03, d: 0.08, v: 0.1 }); noise(c, { d: 0.3, v: 0.12, from: 3000, to: 8000 }); },
  boost: (c) => { tone(c, { f: 150, to: 900, d: 0.35, type: "sawtooth", v: 0.15 }); noise(c, { d: 0.35, v: 0.3, from: 300, to: 5000 }); },
  error: (c) => { tone(c, { f: 220, to: 160, d: 0.18, type: "square", v: 0.12 }); tone(c, { f: 180, to: 130, t: 0.14, d: 0.2, type: "square", v: 0.12 }); },
  alert: (c) => { tone(c, { f: 880, d: 0.1, type: "triangle", v: 0.25 }); tone(c, { f: 660, t: 0.12, d: 0.14, type: "triangle", v: 0.25 }); },
};

const last: Partial<Record<Sfx, number>> = {};
let lastAny = 0;
const BIG: Sfx[] = ["victory", "swap", "reward", "claim", "start", "boost", "confetti"];
export function sfx(name: Sfx) {
  if (!isSoundOn()) return;
  const c = audio();
  if (!c || !master) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = performance.now();
  if (now - (last[name] ?? 0) < 90) return; // no machine-gun repeats
  if (!BIG.includes(name) && now - lastAny < 35) return; // avoid pile-ups
  last[name] = now;
  lastAny = now;
  try { SOUNDS[name](c); } catch { /* ignore */ }
}

let installed = false;
/** Plays a click for every button/link; elements can pick a sound via data-sfx (or data-sfx="none"). */
export function installGlobalSfx() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const u = () => unlock();
  window.addEventListener("pointerdown", u, { capture: true });
  window.addEventListener("keydown", u, { capture: true });
  document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-sfx], button, a, [role=button]");
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
    const name = el.dataset["sfx"];
    if (name === "none") return;
    sfx((name as Sfx) || (el.tagName === "A" ? "nav" : "click"));
  }, { capture: true });
}
