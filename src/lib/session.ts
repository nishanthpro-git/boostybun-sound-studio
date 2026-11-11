export type Session = { code: string; playerId: string; token: string };
export type Profile = { name: string; avatar: string; bg?: number; mask?: number };

const SK = "bb_session";
const PK = "bb_profile";

/** Bunny avatar keys (resolved to images by the Avatar component). */
export const AVATARS = ["bun-1", "bun-2", "bun-3", "bun-4", "bun-5", "bun-6", "bun-7", "bun-8", "bun-9", "bun-10"];

export function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SK) || "null");
  } catch {
    return null;
  }
}
export const saveSession = (s: Session | null) =>
  s ? localStorage.setItem(SK, JSON.stringify(s)) : localStorage.removeItem(SK);

export function loadProfile(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(PK) || "null");
  } catch {
    return null;
  }
}
export const saveProfile = (p: Profile) => localStorage.setItem(PK, JSON.stringify(p));

/** Shrink a selfie to a small square JPEG data URL so it fits in the shared room state. */
export function resizeImage(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      resolve(c.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
