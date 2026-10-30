export const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{4}$`);

export function makeCode(length = 4, rng: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const raw = rng();
    const index = Math.min(CODE_ALPHABET.length - 1, Math.max(0, Math.floor(raw * CODE_ALPHABET.length)));
    out += CODE_ALPHABET[index];
  }
  return out;
}

export function isSessionCode(value: string): boolean {
  return CODE_RE.test(value);
}
