export const SLICE_COLORS = [
  "#E24B3A",
  "#F4E6C4",
  "#1F6A4E",
  "#E8A317",
  "#31597A",
  "#6B4524",
] as const;

export type SlicePaint = { fill: string; ink: string };

type Hsl = { h: number; s: number; l: number };

export function toHsl(hex: string): Hsl {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h * 60, s, l };
}

/** True when two fills would read as the same slice color. */
export function colorsMatch(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const left = toHsl(a);
  const right = toHsl(b);
  let hueGap = Math.abs(left.h - right.h);
  if (hueGap > 180) hueGap = 360 - hueGap;
  const lightGap = Math.abs(left.l - right.l);
  return hueGap < 22 && lightGap < 0.18;
}

export function inkFor(fill: string): string {
  const { l } = toHsl(fill);
  return l > 0.62 ? "#1C1410" : "#F4E7D4";
}

export function assignSliceColors(count: number): SlicePaint[] {
  if (count <= 0) return [];
  const fills: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const banned: string[] = [];
    if (index > 0) banned.push(fills[index - 1]!);
    if (index === count - 1 && count > 1) banned.push(fills[0]!);
    let fill: string | undefined;
    for (let step = 0; step < SLICE_COLORS.length; step += 1) {
      const color = SLICE_COLORS[(index + step) % SLICE_COLORS.length]!;
      if (banned.every((other) => !colorsMatch(color, other))) {
        fill = color;
        break;
      }
    }
    if (!fill) {
      throw new Error(`No distinct color for slice ${index + 1} of ${count}`);
    }
    fills.push(fill);
  }
  return fills.map((fill) => ({ fill, ink: inkFor(fill) }));
}
