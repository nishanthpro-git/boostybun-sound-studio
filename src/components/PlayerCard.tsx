import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { BUNNY_AVATARS, LOGO_URL } from "@/lib/brand";

const MASK_CLASSES = ["avatar-mask-0", "avatar-mask-1", "avatar-mask-2", "avatar-mask-3", "avatar-mask-4"];

/** Avatar clipped to one of five shapes; the image always covers the whole shape. */
export function MaskedAvatar({ src, mask = 0, className, animate }: { src?: string; mask?: number; className?: string; animate?: boolean }) {
  const url = src ? BUNNY_AVATARS[src]?.url ?? (src.startsWith("data:") ? src : undefined) : LOGO_URL;
  const shape = MASK_CLASSES[mask % MASK_CLASSES.length];
  return (
    <span className={cn("relative block aspect-square drop-shadow-[0_0_2px_oklch(1_0_0/0.95)] filter-[drop-shadow(0_0_1.5px_oklch(1_0_0))_drop-shadow(0_6px_12px_oklch(0_0_0/0.6))]", className)}>
      <span key={animate ? mask : undefined} className={cn("block size-full overflow-hidden bg-surface", shape, animate && "mask-pop")}>
        {url ? (
          <img src={url} alt="" draggable={false} className="size-full scale-[1.06] object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-[2.5em]">{src}</span>
        )}
      </span>
    </span>
  );
}

/** Face of a player card: background art, centred shaped avatar and name plate. */
export function CardFace({ avatar, mask, name, onAvatarClick, avatarLabel, animate }: {
  avatar?: string; mask?: number; name?: string; onAvatarClick?: () => void; avatarLabel?: string; animate?: boolean;
}) {
  const av = <MaskedAvatar src={avatar} mask={mask} animate={animate} className="w-full" />;
  return <>
    <span className="relative z-[2] flex flex-1 items-center justify-center pt-2">
      <span aria-hidden className="absolute size-[78%] rounded-full bg-[radial-gradient(circle,oklch(1_0_0/0.45)_0%,transparent_70%)]" />
      {onAvatarClick ? (
        <button type="button" onClick={onAvatarClick} aria-label={avatarLabel} className="relative w-[72%] cursor-pointer rounded-full transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric">{av}</button>
      ) : <span className="relative w-[68%]">{av}</span>}
    </span>
    <span className="relative z-[2] m-1.5 mt-0 block truncate rounded-lg bg-background/75 px-1.5 py-1 text-center text-[11px] font-extrabold text-foreground backdrop-blur-sm sm:text-xs">{name || "?"}</span>
  </>;
}

export const cardBg = (url: string): CSSProperties => ({ backgroundImage: `url(${url})` });
