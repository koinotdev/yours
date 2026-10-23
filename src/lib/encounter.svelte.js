// ============================================================
// the wild encounter, as one shared reactive store
//
// The encounter used to live inside WildEncounter.svelte. The
// pokédex needs the same data — the sets of what you have seen,
// caught and seen shiny — and it opens as a modal over the
// encounter, so the state moved here. A roll in the encounter now
// shows up in the dex without a reload.
//
// The storage itself (the signed payload, the bitsets) is still in
// encounter-store.js; this is only the reactive layer over it, plus
// the dex milestones.
// ============================================================

import { SvelteSet } from "svelte/reactivity";
import {
  load,
  save,
  derive,
  newSeed,
  PARTY_MAX,
  SHINY_ODDS,
} from "./encounter-store.js";
import { unlock } from "./achievements.svelte.js";
import { onGuestChange } from "./share.svelte.js";

// re-exported so a component only needs to import from here
export { derive, newSeed, PARTY_MAX, SHINY_ODDS };

// the day boundary is the visitor's own midnight, not utc
export function dayKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// SvelteSet, not a plain Set: `$state` does not proxy a Set, so a plain
// one would mutate without the pokédex grid ever noticing.
export const encounter = $state({
  day: "",
  seed: "",
  today: null,
  party: [],
  seen: new SvelteSet(),
  caught: new SvelteSet(),
  shiny: new SvelteSet(),
  // the silhouette game: whether today's name is on screen, and the
  // run of correct guesses (a run of days, since there is one a day)
  revealed: false,
  guessRun: 0,
  guessBest: 0,
});

// the stored payload is signed, so reading it is async — until it comes
// back the encounter shows empty grass rather than a half-trusted party
export const encounterReady = $state({ value: false });

// hydrate once for the whole page, however many windows ask
let hydrating = null;
export function hydrate() {
  if (!hydrating) {
    const p = load(dayKey())
      .then((s) => {
        // a guest swap started a newer read; this one is stale
        if (hydrating !== p) return;
        encounter.day = s.day;
        encounter.seed = s.seed;
        encounter.today = s.today;
        encounter.party = s.party;
        encounter.seen = new SvelteSet(s.seen);
        encounter.caught = new SvelteSet(s.caught);
        encounter.shiny = new SvelteSet(s.shiny);
        encounter.revealed = s.revealed;
        encounter.guessRun = s.guessRun;
        encounter.guessBest = s.guessBest;
      })
      .catch(() => {
        /* a failed read leaves the empty grass in place, but the roll must
           still be reachable rather than stuck behind a disabled button */
      })
      .finally(() => {
        encounterReady.value = true;
      });
    hydrating = p;
  }
  return hydrating;
}

export async function persist() {
  await save(encounter);
}

// entering or leaving guest mode swaps the party and the dex, so read
// the store again rather than keep the visitor's own grass on screen
onGuestChange(() => {
  hydrating = null;
  hydrate();
});

/* ---------- the dex milestones ---------- */

// one encounter a day, so these are slow on purpose — they are a record
// of patience, not of grinding
function checkDex() {
  const seen = encounter.seen.size;
  if (seen >= 10) unlock("dex-10");
  if (seen >= 50) unlock("dex-50");
  if (seen >= 100) unlock("dex-100");
  if (encounter.caught.size >= 10) unlock("dex-caught-10");
}

// record a meeting. the shiny set is separate from `seen`, so the dex can
// mark a shiny without losing the plain sighting.
export function recordSeen(id, isShiny) {
  encounter.seen.add(id);
  if (isShiny) encounter.shiny.add(id);
  checkDex();
}

export function recordCaught(id) {
  encounter.caught.add(id);
  checkDex();
}

/* ---------- the silhouette game ---------- */

// show today's name without guessing (the "reveal" escape hatch). a
// skip does not break the run — you chose not to guess, you did not
// guess wrong.
export function revealToday() {
  encounter.revealed = true;
}

// a guess, right or wrong. a right one grows the run and the best;
// a wrong one starts the run over. either way the name is now shown.
export function recordGuess(correct) {
  if (correct) {
    encounter.guessRun += 1;
    if (encounter.guessRun > encounter.guessBest)
      encounter.guessBest = encounter.guessRun;
  } else {
    encounter.guessRun = 0;
  }
  encounter.revealed = true;
}
