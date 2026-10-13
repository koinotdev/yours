// ============================================================
// the pokéapi bits, shared by the wild encounter and the pokédex
//
// Both windows need the same two things: the list of names (one
// ~50 kB request, fetched once and cached for the whole page), and
// a way to turn a dex number into a sprite URL. Neither touches
// `/pokemon/{id}` — that response is ~50 kB *per pokémon*, which
// would dwarf this whole page.
//
// The list endpoint returns only `name` and `url` — no generation.
// `/generation/{id}` exists, but that would be nine more requests.
// Generation is free instead: it is just a range of national-dex
// ids, so it is derived here rather than fetched.
// ============================================================

export const DEX_MAX = 1025; // matches the list endpoint's ?limit

const LIST = `https://pokeapi.co/api/v2/pokemon?limit=${DEX_MAX}`;

// the nine generations, as national-dex id ranges. the last one is
// open-ended so it still holds if the dex ever grows past 1025.
export const GEN_RANGES = [
  { gen: 1, from: 1, to: 151 },
  { gen: 2, from: 152, to: 251 },
  { gen: 3, from: 252, to: 386 },
  { gen: 4, from: 387, to: 493 },
  { gen: 5, from: 494, to: 649 },
  { gen: 6, from: 650, to: 721 },
  { gen: 7, from: 722, to: 809 },
  { gen: 8, from: 810, to: 905 },
  { gen: 9, from: 906, to: DEX_MAX },
];

// the sprite is derived from the id, never fetched per pokémon: the
// github mirror serves a plain png at a predictable path.
export const spriteUrl = (id, shiny) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
    shiny ? "shiny/" : ""
  }${id}.png`;

// a stable key for one sprite, so a broken image in one slot does not
// blank out the others
export const spriteKey = (p) => `${p.id}:${p.shiny ? 1 : 0}`;

/* ---------- the list, fetched once ---------- */

// The promise is cached, not the result, so two windows opening at the
// same moment share one request rather than racing. A failure clears it,
// so a later click can try again instead of being stuck with the error.
let poolPromise = null;

export function loadPool() {
  if (!poolPromise) {
    poolPromise = fetch(LIST)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => data.results)
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

// the dex number an entry points at, read from the tail of its url
// (`.../pokemon/25/` → 25)
export const idOf = (entry) =>
  Number(entry.url.split("/").filter(Boolean).pop());
