import { isSessionCode } from "@/lib/codes";

const STORAGE_KEY = "www-nights";
const MAX_NIGHTS = 30;

export const NIGHTS_EVENT = "www-nights";

export type RememberedNight = {
  code: string;
  touchedAt: number;
};

export function readNights(): RememberedNight[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const nights: RememberedNight[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const code = "code" in item && typeof item.code === "string" ? item.code.toLowerCase() : "";
      const touchedAt = "touchedAt" in item && typeof item.touchedAt === "number" ? item.touchedAt : 0;
      if (!isSessionCode(code)) continue;
      nights.push({ code, touchedAt });
    }
    nights.sort((a, b) => b.touchedAt - a.touchedAt);
    return nights;
  } catch {
    return [];
  }
}

export function rememberNight(code: string) {
  const cleaned = code.toLowerCase();
  if (!isSessionCode(cleaned)) return;
  const next = [
    { code: cleaned, touchedAt: Date.now() },
    ...readNights().filter((night) => night.code !== cleaned),
  ].slice(0, MAX_NIGHTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(NIGHTS_EVENT));
}

export function forgetNights(codes: string[]) {
  const drop = new Set(codes.map((code) => code.toLowerCase()));
  const next = readNights().filter((night) => !drop.has(night.code));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
