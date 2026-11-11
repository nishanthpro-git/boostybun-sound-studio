import { Volume2, VolumeX } from "lucide-react";
import { setSoundOn, useSoundOn } from "@/lib/sfx";

export function SoundToggle() {
  const on = useSoundOn();
  return (
    <button
      type="button"
      data-sfx="none"
      onClick={() => setSoundOn(!on)}
      aria-label={on ? "Mute sound effects" : "Turn sound effects on"}
      aria-pressed={!on}
      title={on ? "Sound on" : "Sound off"}
      className="fixed top-1.5 right-2 z-40 inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-lg backdrop-blur transition-transform hover:scale-105 active:scale-95"
    >
      {on ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-muted-foreground" />}
    </button>
  );
}
