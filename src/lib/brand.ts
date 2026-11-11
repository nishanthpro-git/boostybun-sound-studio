// Browser-safe brand asset registry: bunny avatars, card backs, logo and the BoostyBuns coin.
import a1 from "@/assets/avatars/bunny-avatar-1.webp.asset.json";
import a2 from "@/assets/avatars/bunny-avatar-2.webp.asset.json";
import a3 from "@/assets/avatars/bunny-avatar-3.webp.asset.json";
import a4 from "@/assets/avatars/bunny-avatar-4.webp.asset.json";
import a5 from "@/assets/avatars/bunny-avatar-5.webp.asset.json";
import a6 from "@/assets/avatars/bunny-avatar-6.webp.asset.json";
import a7 from "@/assets/avatars/bunny-avatar-7.webp.asset.json";
import a8 from "@/assets/avatars/bunny-avatar-8.webp.asset.json";
import a9 from "@/assets/avatars/bunny-avatar-9.webp.asset.json";
import a10 from "@/assets/avatars/bunny-avatar-10.webp.asset.json";
import c1 from "@/assets/cards/card-back-1.webp.asset.json";
import c2 from "@/assets/cards/card-back-2.webp.asset.json";
import c3 from "@/assets/cards/card-back-3.webp.asset.json";
import c4 from "@/assets/cards/card-back-4.webp.asset.json";
import c5 from "@/assets/cards/card-back-5.webp.asset.json";
import c6 from "@/assets/cards/card-back-6.webp.asset.json";
import c7 from "@/assets/cards/card-back-7.webp.asset.json";
import c8 from "@/assets/cards/card-back-8.webp.asset.json";
import c9 from "@/assets/cards/card-back-9.webp.asset.json";
import c10 from "@/assets/cards/card-back-10.webp.asset.json";
import logo from "@/assets/boostybun-logo-badge.webp.asset.json";
import coin from "@/assets/boostybun-coin.webp.asset.json";
import wildSwap from "@/assets/wild-swap-card.webp.asset.json";

export const LOGO_URL = logo.url;
export const COIN_URL = coin.url;
export const WILD_SWAP_URL = wildSwap.url;

/** Avatar mask shapes, cycled by tapping the avatar on the card preview. */
export const MASKS = ["Circle", "Rounded square", "Rounded diamond", "Rounded triangle", "Rounded hexagon"] as const;

/** Avatar keys stored in player profiles/room state; resolved to images on render. */
export const BUNNY_AVATARS: Record<string, { url: string; label: string }> = {
  "bun-1": { url: a1.url, label: "Cool bunny" },
  "bun-2": { url: a2.url, label: "Happy bunny" },
  "bun-3": { url: a3.url, label: "Angry bunny" },
  "bun-4": { url: a4.url, label: "Sleepy bunny" },
  "bun-5": { url: a5.url, label: "Robot bunny" },
  "bun-6": { url: a6.url, label: "Wizard bunny" },
  "bun-7": { url: a7.url, label: "Dino bunny" },
  "bun-8": { url: a8.url, label: "King bunny" },
  "bun-9": { url: a9.url, label: "Lovestruck bunny" },
  "bun-10": { url: a10.url, label: "Shadow bunny" },
};

export const CARD_BACKS = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10].map((c) => c.url);

/** Card art per owner: seat order gives up to 10 players distinct backgrounds. */
export function cardBackFor(ownerId: string, playerIds: string[], chosen?: number) {
  if (chosen !== undefined && CARD_BACKS[chosen]) return CARD_BACKS[chosen];
  let i = playerIds.indexOf(ownerId);
  if (i < 0) i = [...ownerId].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return CARD_BACKS[i % CARD_BACKS.length];
}
