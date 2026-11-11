import { cn } from "@/lib/utils";
import { BUNNY_AVATARS, LOGO_URL } from "@/lib/brand";

export function Avatar({ src, className }: { src?: string; className?: string }) {
  const bunny = src ? BUNNY_AVATARS[src] : undefined;
  if (bunny || src?.startsWith("data:")) {
    return (
      <img
        src={bunny?.url ?? src}
        alt=""
        draggable={false}
        className={cn("avatar-frame size-10 shrink-0 rounded-full bg-surface object-cover", className)}
      />
    );
  }
  if (!src) {
    return <img src={LOGO_URL} alt="" draggable={false} className={cn("avatar-frame size-10 shrink-0 rounded-full bg-surface object-contain p-0.5", className)} />;
  }
  return (
    <span
      className={cn(
        "avatar-frame inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xl",
        className,
      )}
    >
      {src}
    </span>
  );
}
