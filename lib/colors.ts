export const SLICE_COLORS = [
  "#E25B45",
  "#E7A33A",
  "#F0D7A4",
  "#6E8F72",
  "#3E6B78",
  "#D4785A",
  "#C4546A",
  "#E6C15A",
  "#8B6B4A",
  "#4E6E62",
  "#D98B6A",
  "#A33B32",
] as const;

export function colorForId(id: string): { fill: string; ink: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const fill = SLICE_COLORS[hash % SLICE_COLORS.length]!;
  return { fill, ink: isLight(fill) ? "#1C1410" : "#F4E7D4" };
}

function isLight(hex: string): boolean {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 155;
}
