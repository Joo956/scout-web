// ✅ Cryptographically secure temporary password generator
// Uses crypto.getRandomValues() for true randomness
// Unambiguous character set: no 0/O, 1/l/I confusion

export function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join('');
}
