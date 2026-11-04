import type { Phase } from "./types";

const CONTROL = /[\u0000-\u001f\u007f]/;

export const NIGHT_NAME_MAX = 40;

export function cleanName(input: string): string | null {
  const name = input.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > 24) return null;
  if (CONTROL.test(name)) return null;
  return name;
}

export function cleanTitle(input: string): string | null {
  const title = input.replace(/\s+/g, " ").trim();
  if (title.length < 1 || title.length > 60) return null;
  if (CONTROL.test(title)) return null;
  return title;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function cleanNightName(input: string): { ok: true; name: string | null } | { ok: false } {
  const name = input.replace(/\s+/g, " ").trim();
  if (!name) return { ok: true, name: null };
  if (name.length > NIGHT_NAME_MAX) return { ok: false };
  if (CONTROL.test(name)) return { ok: false };
  return { ok: true, name };
}

export function displayNightName(name: string | null | undefined, code: string): string {
  const cleaned = name?.replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned;
  return `Night ${code}`;
}

export function nightStatusLabel(status: Phase, spinning = false): string {
  if (status === "complete") return "Done";
  if (status === "locked" && spinning) return "Spinning";
  if (status === "locked") return "Locked";
  return "Adding shows";
}

export function nightStatusKey(status: Phase, spinning = false): "open" | "locked" | "spinning" | "complete" {
  if (status === "complete") return "complete";
  if (status === "locked" && spinning) return "spinning";
  if (status === "locked") return "locked";
  return "open";
}

export function formatNight(iso: string | null): string {
  if (!iso) return "Earlier";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Earlier";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
