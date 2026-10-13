// ============================================================
// sharing
//
// A link can carry a whole room: the config, and the small personal
// stores that make it feel lived-in. The payload is json, deflated,
// then base64url'd into the *fragment* — so it is never sent to the
// server, and the page's promise that nothing leaves the browser
// still holds.
//
// Opening a link puts the page into "guest" mode: the sharer's room
// is rendered, but nothing is written to localStorage, so the
// visitor's own room is untouched. Every store reads and writes
// through readStore()/writeStore() below, which is the only place
// that knows about guest mode.
//
// The payload is decoded at module load (top-level await), so the
// stores see guest mode already set the first time they read — no
// reload dance on the way in. Only a runtime change (go home, make
// it mine) has to tell the stores to read again.
// ============================================================

const VERSION = 1;

// a link is a url, so it has limits. these are generous but finite,
// and they are what stops a hostile link from being a decompression
// bomb: the fragment is capped before it is decoded, and the decoded
// bytes are capped while they stream out.
const MAX_ENCODED = 200_000; // characters in the fragment
export { MAX_ENCODED };
const MAX_DECODED = 2_000_000; // bytes after inflate
const MAX_STORE = 1_500_000; // bytes in any one store

// the stores a link always carries: the furniture, not the private
// things. These are shown to a visitor but never imported by "make
// it mine" — you can see someone's trophies, you cannot claim them.
export const VIEW_KEYS = [
  "yours.ledger.v1", // the trophy cabinet
  "yours.cache.v2", // the party + the dex
  "yours.trivia", // the trivia day streak
  "cat.pos", // where the cat is parked
  "vine.best", // the VINE.EXE high score
  "synth.sound", // the synth knobs
  "synth.layout", // the synth key mapping
];

// the stores a link carries only when the sharer ticks the box.
export const OPT_IN_KEYS = ["yours.notes", "yours.doodle"];

/* ---------- base64url ---------- */

function b64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  const b = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4 ? "=".repeat(4 - (b.length % 4)) : "";
  const bin = atob(b + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- deflate / inflate ---------- */

async function deflate(str) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const stream = new Blob([str])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

// read a stream but stop if it grows past `max`, so a small compressed
// payload cannot expand into an unbounded one
async function readLimited(stream, max) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new Error("payload too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function inflate(bytes) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await readLimited(stream, MAX_DECODED);
  return new TextDecoder().decode(buf);
}

/* ---------- the payload ---------- */

// "z" = deflated json, "j" = plain json (when CompressionStream is
// missing). The tag keeps the two readable by the same decoder.
export async function encodePayload(payload) {
  const json = JSON.stringify(payload);
  const z = await deflate(json);
  if (z) return "z" + b64url(z);
  return "j" + b64url(new TextEncoder().encode(json));
}

export async function decodePayload(str) {
  if (typeof str !== "string" || !str) throw new Error("empty payload");
  const tag = str[0];
  const body = str.slice(1);
  if (tag === "z") return JSON.parse(await inflate(unb64url(body)));
  if (tag === "j") return JSON.parse(new TextDecoder().decode(unb64url(body)));
  throw new Error("unknown payload");
}

// a payload from a stranger is not trusted: keep only the keys we
// know, only strings, and only up to the size caps
function sanitizePayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src =
    raw.stores && typeof raw.stores === "object" && !Array.isArray(raw.stores)
      ? raw.stores
      : {};
  const stores = {};
  for (const key of [...VIEW_KEYS, ...OPT_IN_KEYS]) {
    const v = src[key];
    if (typeof v === "string" && v.length <= MAX_STORE) stores[key] = v;
  }
  return {
    v: VERSION,
    config:
      raw.config && typeof raw.config === "object" && !Array.isArray(raw.config)
        ? raw.config
        : {},
    stores,
  };
}

/* ---------- the fragment ---------- */

function shareParam() {
  if (typeof location === "undefined") return null;
  const m = /[#&]share=([^&]+)/.exec(location.hash);
  return m ? m[1] : null;
}

async function fromHash() {
  const p = shareParam();
  if (!p || p.length > MAX_ENCODED) return null;
  try {
    return sanitizePayload(await decodePayload(decodeURIComponent(p)));
  } catch {
    return null;
  }
}

// build the link for a payload — the caller assembles the payload
export async function buildShareURL(payload) {
  const encoded = await encodePayload(payload);
  const base = location.origin + location.pathname + location.search;
  return `${base}#share=${encoded}`;
}

/* ---------- guest mode ---------- */

// `payload` is null when not a guest. It lives in an object because a
// module cannot export state that is reassigned — only its properties
// may change. It is filled in asynchronously (deflate has no sync api),
// so a store reads its own data first and is told to read again once the
// payload lands — see onGuestChange below.
export const share = $state({ payload: null });

export function isGuest() {
  return share.payload !== null;
}

// the single door every store goes through. In guest mode a read
// comes from the payload (and a missing key is empty, never the
// visitor's own data), and a write is dropped.
export function readStore(key) {
  if (share.payload) return share.payload.stores?.[key] ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key, value) {
  if (share.payload) return; // read-only: a guest never writes
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or a full quota — the value still lives on screen */
  }
}

/* ---------- runtime transitions ---------- */

const listeners = new Set();

// a store registers here to be told when guest mode changes, so it
// can read again. Returns an unsubscribe.
export function onGuestChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

// decode the fragment once, as early as the module is loaded. The
// stores read their own data first; when this lands they are told to
// read again, and the page swaps to the sharer's room. The boot screen
// covers the swap, so it is not seen.
let started = false;
function initShare() {
  if (started) return Promise.resolve();
  started = true;
  return fromHash()
    .then((payload) => {
      if (!payload) return;
      share.payload = payload;
      notify();
    })
    .catch(() => {
      /* a broken link is simply not a guest link */
    });
}

// resolves once the fragment has been read (or found not to be a share
// link). a caller that must not act before guest mode is known — the
// small-hours trophy, say — can wait on it, so a guest visit never
// touches the visitor's own stores in the moment before the payload lands.
export const shareReady = initShare();

// leave guest mode: back to the visitor's own room
export function leaveGuest() {
  if (!share.payload) return;
  share.payload = null;
  notify();
}

// "make it mine": copy the opt-in stores into the visitor's own
// storage. The view-only stores are deliberately left behind, and a
// store the visitor already has is never overwritten — adopting a room
// should not erase the one you were already keeping.
export function importOptIn() {
  if (!share.payload) return;
  for (const key of OPT_IN_KEYS) {
    const v = share.payload.stores?.[key];
    if (v == null) continue;
    let existing = null;
    try {
      existing = localStorage.getItem(key);
    } catch {
      /* private mode */
    }
    if (existing) continue;
    try {
      localStorage.setItem(key, v);
    } catch {
      /* private mode or a full quota */
    }
  }
}
