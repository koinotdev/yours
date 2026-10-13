// ============================================================
// the wild encounter's storage
//
// The signing key is right here in the source, so anyone who
// reads the bundle can reproduce it. The goal is only that a
// casual hand-edit of localStorage no longer sticks:
//
//   - the shiny flag and the dex number are never read back.
//     they are re-derived from a stored seed, so flipping
//     `shiny: true` in devtools does nothing at all.
//   - the party is covered by an HMAC, so appending a pokémon
//     (or editing one) without re-signing the whole payload
//     fails verification and the store is treated as tampered.
//
// The pokédex lives here too: three sets of dex numbers — the ones
// you have seen, the ones you have caught, and the ones you have
// seen shiny. They are stored as a *bitset* (one bit per dex number,
// base64'd), so all 1025 entries cost about 172 characters each
// rather than a few kilobytes of json. They are covered by the same
// signature as the party.
//
// The silhouette game's streak lives here as well: `revealed` (whether
// today's name has been shown), and `guessRun` / `guessBest`, the run
// of correct guesses. Because there is one encounter a day, that run
// is really a run of *days* — so it is kept across the day turning,
// unlike the encounter itself.
// ============================================================

import { hmac, same } from "./sign.js";
import { readStore, writeStore } from "./share.svelte.js";
import { DEX_MAX } from "./pokeapi.js";

export { DEX_MAX };

const KEY = "yours.cache.v2"; // not named after "encounter"
const SALT = "yours.home/wild-encounter/v2";
export const SHINY_ODDS = 4096;

export const PARTY_MAX = 6;

/* ---------- the seed ---------- */

// 8 random bytes, hex — opaque, and enough to make the roll unguessable
export function newSeed() {
  const b = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(b);
  else
    for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// fold the seed into a 32-bit state (FNV-1a)
function fold(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 — small, deterministic, seeded
function rng(state) {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the encounter is a pure function of the seed — it is never stored
export function derive(seed) {
  const r = rng(fold(String(seed)));
  return {
    id: 1 + Math.floor(r() * DEX_MAX),
    shiny: r() < 1 / SHINY_ODDS,
  };
}

/* ---------- the signature ---------- */

// the HMAC lives in sign.js, shared with the trophy store

/* ---------- shape ---------- */

// a stored mon is only trusted as far as it looks like one
const cleanName = (name, id) =>
  typeof name === "string" && name ? name.slice(0, 40) : `#${id}`;

// the nickname is cosmetic, but it is still untrusted input — trim it and
// cap it at the same 40 chars the rename field allows
const cleanNick = (nick) =>
  typeof nick === "string" ? nick.trim().slice(0, 40) : "";

function cleanMon(m) {
  if (!m || typeof m !== "object") return null;
  const id = Number(m.id);
  if (!Number.isInteger(id) || id < 1 || id > DEX_MAX) return null;
  return {
    id,
    name: cleanName(m.name, id),
    shiny: m.shiny === true,
    nickname: cleanNick(m.nickname),
  };
}

// a fresh state each time — a shared object would leak the party array
// across loads, since the caller pushes into it in place
const empty = () => ({
  day: "",
  seed: "",
  today: null,
  party: [],
  seen: new Set(),
  caught: new Set(),
  shiny: new Set(),
  revealed: false,
  guessRun: 0,
  guessBest: 0,
});

// a stored counter is only trusted as far as it looks like one
const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

/* ---------- the dex sets, as a bitset ----------
   One bit per dex number, little-endian within each byte, then
   base64'd. 1025 bits is 129 bytes — about 172 characters, small
   enough that three of them still fit comfortably in the payload. */

const BYTES = Math.ceil(DEX_MAX / 8);

function encodeSet(set) {
  const bytes = new Uint8Array(BYTES);
  if (set) {
    for (const id of set) {
      if (!Number.isInteger(id) || id < 1 || id > DEX_MAX) continue;
      const i = id - 1;
      bytes[i >> 3] |= 1 << (i & 7);
    }
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// anything that is not a decodable string is treated as an empty set,
// so a hand-edited payload can never throw or invent entries
function decodeSet(str) {
  const out = new Set();
  if (typeof str !== "string" || !str) return out;
  let bin;
  try {
    bin = atob(str);
  } catch {
    return out;
  }
  for (let i = 0; i < bin.length && i < BYTES; i++) {
    const b = bin.charCodeAt(i);
    if (!b) continue;
    for (let bit = 0; bit < 8; bit++) {
      if (b & (1 << bit)) {
        const id = i * 8 + bit + 1;
        if (id <= DEX_MAX) out.add(id);
      }
    }
  }
  return out;
}

/* ---------- load & save ---------- */

// `today` is the visitor's local day key. The encounter is re-derived from
// the seed; only the name, the party and the dex sets are read back, and
// only once the signature over them checks out.
export async function load(today) {
  let raw;
  try {
    raw = JSON.parse(readStore(KEY) || "null");
  } catch {
    return empty();
  }
  if (!raw || typeof raw !== "object" || typeof raw.d !== "string")
    return empty();

  // verify before trusting a single byte of the payload
  const sig = await hmac(raw.d, SALT);
  if (sig !== null && !same(sig, raw.s)) return empty();

  let d;
  try {
    d = JSON.parse(raw.d);
  } catch {
    return empty();
  }
  if (!d || typeof d !== "object") return empty();

  const party = Array.isArray(d.party)
    ? d.party.map(cleanMon).filter(Boolean).slice(0, PARTY_MAX)
    : [];

  // yesterday's encounter is spent — drop it rather than show it again.
  // the dex sets are not about today, so they survive the day turning,
  // and so does the guess streak (it is a run of days, not of today).
  const seen = decodeSet(d.seen);
  const caught = decodeSet(d.caught);
  const shinySet = decodeSet(d.shiny);
  const guessRun = count(d.guessRun);
  const guessBest = count(d.guessBest);
  if (d.day !== today || typeof d.seed !== "string" || !d.seed) {
    return {
      day: "",
      seed: "",
      today: null,
      party,
      seen,
      caught,
      shiny: shinySet,
      revealed: true,
      guessRun,
      guessBest,
    };
  }

  const { id, shiny } = derive(d.seed);
  const name = cleanName(d.name, id);
  return {
    day: today,
    seed: d.seed,
    today: { id, shiny, name },
    party,
    seen,
    caught,
    shiny: shinySet,
    // a payload written before the silhouette game existed has no
    // `revealed` field — treat it as already revealed, so an old
    // encounter is not suddenly hidden behind a guess prompt
    revealed: d.revealed === undefined ? true : d.revealed === true,
    guessRun,
    guessBest,
  };
}

export async function save(state) {
  const d = JSON.stringify({
    day: state.day,
    seed: state.seed,
    name: state.today?.name ?? "",
    party: state.party,
    seen: encodeSet(state.seen),
    caught: encodeSet(state.caught),
    shiny: encodeSet(state.shiny),
    revealed: state.revealed === true,
    guessRun: count(state.guessRun),
    guessBest: count(state.guessBest),
  });
  const s = await hmac(d, SALT);
  writeStore(KEY, JSON.stringify({ d, s }));
}
