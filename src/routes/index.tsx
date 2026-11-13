import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/Avatar";
import { LogoBadge, Wordmark } from "@/components/Brand";
import { AVATARS, loadProfile, saveProfile, saveSession } from "@/lib/session";
import { BUNNY_AVATARS, CARD_BACKS, MASKS } from "@/lib/brand";
import { CardFace, cardBg } from "@/components/PlayerCard";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { SelfieCamera } from "@/components/SelfieCamera";
import { createRoom, joinRoom } from "@/lib/room.functions";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ join: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "BoostyBun — Multiplayer card passing game" },
      { name: "description", content: "Create or join a BoostyBun room, pass cards, collect three of a kind and BOOST!" },
      { property: "og:title", content: "BoostyBun — Multiplayer card passing game" },
      { property: "og:description", content: "Pass cards, collect three of a kind and BOOST with 2–10 friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { join } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [code, setCode] = useState(join ?? "");
  const [busy, setBusy] = useState(false);
  const [bg, setBg] = useState(0);
  const [mask, setMask] = useState(0);
  const [selfie, setSelfie] = useState<string | null>(null);
  const choices = selfie ? [selfie, ...AVATARS] : AVATARS;
  const stepAvatar = (d: number) => {
    const i = Math.max(0, choices.indexOf(avatar));
    setAvatar(choices[(i + d + choices.length) % choices.length]);
  };
  const stepBg = (d: number) => setBg((b) => (b + d + CARD_BACKS.length) % CARD_BACKS.length);
  const [hints, setHints] = useState({ bg: false, shape: false });
  useEffect(() => {
    try { setHints({ bg: !localStorage.getItem("boostybun:hint-bg"), shape: !localStorage.getItem("boostybun:hint-shape") }); } catch { /* ignore */ }
  }, []);
  const doneHint = (k: "bg" | "shape") => {
    if (!hints[k]) return;
    setHints((h) => ({ ...h, [k]: false }));
    try { localStorage.setItem(`boostybun:hint-${k}`, "1"); } catch { /* ignore */ }
  };
  const tapBg = () => { sfx("background"); stepBg(1); doneHint("bg"); };
  const tapShape = () => { sfx("mask"); setMask((m) => (m + 1) % MASKS.length); doneHint("shape"); };
  const pickOther = (n: number, cur: number) => (n < 2 ? 0 : (cur + 1 + Math.floor(Math.random() * (n - 1))) % n);
  const randomize = () => {
    sfx("pop");
    const ai = Math.max(0, choices.indexOf(avatar));
    setAvatar(choices[pickOther(choices.length, ai)]);
    setBg((b) => pickOther(CARD_BACKS.length, b));
    setMask((m) => pickOther(MASKS.length, m));
  };
  const takeSelfie = (photo: string) => { sfx("avatar"); setSelfie(photo); setAvatar(photo); };

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setName(p.name);
      setAvatar(p.avatar);
      if (p.avatar.startsWith("data:")) setSelfie(p.avatar);
      if (p.bg !== undefined) setBg(p.bg);
      if (p.mask !== undefined) setMask(p.mask);
    }
  }, []);

  const go = async (mode: "create" | "join") => {
    if (!name.trim()) return toast.error("Enter a display name");
    if (mode === "join" && code.trim().length !== 6) return toast.error("Room code is 6 characters");
    setBusy(true);
    try {
      saveProfile({ name: name.trim(), avatar, bg, mask });
      const res =
        mode === "create"
          ? await createRoom({ data: { name: name.trim(), avatar, bg, mask } })
          : await joinRoom({ data: { name: name.trim(), avatar, bg, mask, code: code.trim().toUpperCase() } });
      if ("error" in res && res.error) throw new Error(res.error);
      const r = res as { code: string; playerId: string; token: string };
      saveSession(r);
      sfx(mode === "create" ? "create" : "join");
      navigate({ to: "/room/$code", params: { code: r.code } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen-in mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-6 px-4 py-8 sm:py-12 lg:flex-row lg:items-center lg:gap-12">
      {/* Brand */}
      <header className="flex flex-col items-center text-center lg:flex-1">
        <div className="relative">
          <div aria-hidden className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--electric)_55%,transparent)_0%,transparent_70%)] blur-2xl" />
          <LogoBadge className="float-y relative size-40 sm:size-52 lg:size-72" />
        </div>
        <h1 className="-mt-2 text-5xl sm:text-6xl lg:text-7xl">
          <Wordmark />
        </h1>
        <p className="mt-3 max-w-xs font-display text-lg text-muted-foreground sm:text-xl">
          Collect 3 of a kind. Then <span className="font-bold text-primary">BOOST!</span>
        </p>
        <div aria-hidden className="mt-5 hidden items-center lg:flex">
          {AVATARS.slice(0, 5).map((a, i) => (
            <span key={a} className={cn("relative", i > 0 && "-ml-3")} style={{ zIndex: 10 - i }}>
              <Avatar src={a} className="size-11" />
            </span>
          ))}
          <span className="ml-3 text-sm font-bold text-muted-foreground">2–10 players</span>
        </div>
      </header>

      <div className="flex w-full max-w-md flex-col gap-4 lg:flex-1">
        {/* Profile */}
        <section className="panel space-y-4 p-5">
          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Display name</label>
            <Input id="display-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Bunny" />
          </div>
          <div className="relative mx-auto w-56 sm:w-64">
            <div
              key={bg}
              role="button"
              tabIndex={0}
              aria-label={`Change background (now ${bg + 1} of ${CARD_BACKS.length})`}
              data-sfx="none"
              onClick={tapBg}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapBg(); } }}
              style={cardBg(CARD_BACKS[bg])}
              className="preview-swap game-card flex aspect-[5/7] w-full cursor-pointer flex-col bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
            >
              <CardFace avatar={avatar} mask={mask} name={name.trim() || "You"} animate onAvatarClick={tapShape} avatarLabel={`Change shape (now ${MASKS[mask]})`} />
            </div>
            {hints.bg && <div aria-hidden className="screen-in pointer-events-none absolute top-2 -left-3 z-10 flex flex-col items-start gap-1">
              <span className="rounded-full bg-electric px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-primary-foreground shadow-lg">Tap here to change the background</span>
              <span className="tap-hint ml-3 text-3xl drop-shadow-lg">👆</span>
            </div>}
            {hints.shape && <div aria-hidden className="screen-in pointer-events-none absolute top-[58%] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
              <span className="tap-hint text-3xl drop-shadow-lg">👆</span>
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-primary-foreground shadow-lg">Tap here to change the shape!</span>
            </div>}
          </div>
          <div className="flex justify-center">
            <Button variant="secondary" className="rounded-full font-display" data-sfx="none" onClick={randomize}><Shuffle className="size-4" /> Random</Button>
          </div>
          <p className="text-center text-xs font-bold text-muted-foreground">Tap the card to change background · tap your bunny to change shape · {MASKS[mask]}</p>
          <Stepper sound="avatar" label="Avatar" value={selfie && avatar === selfie ? "Your selfie" : BUNNY_AVATARS[avatar]?.label ?? "Bunny"} onPrev={() => stepAvatar(-1)} onNext={() => stepAvatar(1)} />
          <Stepper sound="background" label="Background" value={`${bg + 1} / ${CARD_BACKS.length}`} onPrev={() => stepBg(-1)} onNext={() => stepBg(1)} />
          <div className="flex justify-center"><SelfieCamera onCapture={takeSelfie} /></div>
        </section>

        {/* Play */}
        <section className="panel space-y-4 p-5">
          <Button variant="game" size="xl" className="w-full text-xl" data-sfx="pop" disabled={busy} onClick={() => go("create")}>
            Create room
          </Button>
          <div className="flex items-center gap-3 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" />or join a friend<span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex gap-2">
            <Input
              value={code}
              aria-label="Room code"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ROOM CODE"
              className="h-14 min-w-0 flex-1 text-center font-display text-xl tracking-[0.3em] placeholder:tracking-[0.2em]"
            />
            <Button variant="secondary" size="xl" className="h-14 px-6 font-display text-lg" disabled={busy} onClick={() => go("join")}>
              Join
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stepper({ label, value, onPrev, onNext, sound }: { sound: string; label: string; value: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="panel-inset flex items-center gap-2 p-1.5">
      <Button variant="secondary" size="icon" className="rounded-full" data-sfx={sound} aria-label={`Previous ${label.toLowerCase()}`} onClick={onPrev}><ChevronLeft /></Button>
      <div className="min-w-0 flex-1 text-center">
        <div className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">{label}</div>
        <div className="truncate font-display text-base font-bold">{value}</div>
      </div>
      <Button variant="secondary" size="icon" className="rounded-full" data-sfx={sound} aria-label={`Next ${label.toLowerCase()}`} onClick={onNext}><ChevronRight /></Button>
    </div>
  );
}
