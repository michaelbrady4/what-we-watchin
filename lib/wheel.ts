export function spinAnimMs(windowMs: number): number {
  const hold = Math.min(700, Math.floor(windowMs * 0.35));
  return Math.max(0, windowMs - hold);
}

export function easeOutQuint(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 5;
}

export function landingRotation(index: number, count: number, turns = 4): number {
  if (count <= 0) return 0;
  const slice = 360 / count;
  const targetMod = (360 - ((index * slice) % 360)) % 360;
  return turns * 360 + targetMod;
}

export function sliceUnderPointer(rotationDeg: number, count: number): number {
  if (count <= 0) return 0;
  const slice = 360 / count;
  const normalized = ((rotationDeg % 360) + 360) % 360;
  const local = (360 - normalized) % 360;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i += 1) {
    let dist = Math.abs(i * slice - local);
    if (dist > 180) dist = 360 - dist;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export function labelBudget(count: number): { maxChars: number; font: number; mode: "upright" | "radial" } {
  if (count <= 2) return { maxChars: 18, font: 4.6, mode: "upright" };
  const arc = (2 * Math.PI * 20) / Math.max(count, 1);
  const cap = count <= 4 ? 4.3 : count <= 8 ? 3.5 : 3.1;
  const font = Math.max(1.85, Math.min(cap, arc * 0.55));
  const room = count <= 6 ? 26 : 22;
  const maxChars = Math.max(4, Math.min(18, Math.floor(room / (font * 0.56))));
  return { maxChars, font, mode: "radial" };
}

export function truncateTitle(title: string, maxChars: number): string {
  const clean = title.trim();
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 1) return "…";
  return `${clean.slice(0, maxChars - 1).trimEnd()}…`;
}

export function polar(cx: number, cy: number, radius: number, angleFromTop: number): { x: number; y: number } {
  const rad = ((angleFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

export type SliceGeom = { index: number; mid: number; start: number; end: number; span: number };

export function sliceGeometry(count: number): SliceGeom[] {
  if (count < 1) return [];
  const slice = 360 / count;
  const gap = Math.min(1.15, slice * 0.045);
  return Array.from({ length: count }, (_, index) => {
    const mid = index * slice;
    const start = mid - slice / 2 + gap / 2;
    const end = mid + slice / 2 - gap / 2;
    const span = (end - start + 360) % 360;
    return { index, mid, start, end, span };
  });
}

export function wedgePath(
  start: number,
  end: number,
  radius = 47.2,
  cx = 50,
  cy = 50,
): string {
  const span = ((end - start) % 360 + 360) % 360;
  if (span >= 359.2 || span === 0) {
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`;
  }
  const a = polar(cx, cy, radius, start);
  const b = polar(cx, cy, radius, end);
  const large = span > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${a.x.toFixed(3)} ${a.y.toFixed(3)} A ${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(3)} ${b.y.toFixed(3)} Z`;
}
