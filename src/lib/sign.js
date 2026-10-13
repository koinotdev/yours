// ============================================================
// a tiny signing helper, shared by the two stores that want a
// hand-edit of localStorage to not stick: the wild encounter's
// party, and the trophy list.
//
// This is obfuscation, not security. The salt is right here in
// the source, so anyone who reads the bundle can reproduce it.
// The point is only that a casual edit in devtools no longer
// survives a reload.
// ============================================================

const enc = new TextEncoder();
const keys = new Map();

// importing the key is the expensive half of an HMAC, and the salt never
// changes, so the CryptoKey is imported once per salt and reused
async function keyFor(subtle, salt) {
  let key = keys.get(salt);
  if (!key) {
    key = await subtle.importKey(
      "raw",
      enc.encode(salt),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    keys.set(salt, key);
  }
  return key;
}

// returns null when there is no SubtleCrypto (an insecure context), in
// which case callers store and read unsigned rather than break the page
export async function hmac(text, salt) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const key = await keyFor(subtle, salt);
    const sig = await subtle.sign("HMAC", key, enc.encode(text));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  } catch {
    return null;
  }
}

// constant-time-ish compare, so a wrong signature is not found byte by byte
export function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
