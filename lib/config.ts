export function spinWindowMs(): number {
  const raw = process.env.SPIN_WINDOW_MS;
  if (!raw) return 5200;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 5200;
  return Math.min(20_000, Math.max(400, Math.round(value)));
}
