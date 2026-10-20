// ============================================================
// the trophy cabinet
//
// Small, quiet achievements for the things you can do here. Like
// the notebook and the party, they are yours: exporting your
// "home" never carries them out with it.
//
// The list is signed, the same way the party is (see sign.js).
// A hand-edit of localStorage that adds a trophy breaks the
// signature, and the whole list is then treated as tampered, so
// the casual devtools edit does not stick.
//
// Each trophy has three strings:
//   name — always visible, so the cabinet shows what exists
//   hint — shown while it is still dark, a nudge and nothing more
//   desc — the flavour, revealed only once you have earned it
// ============================================================

import { hmac, same } from "./sign.js";
import {
  readStore,
  writeStore,
  isGuest,
  onGuestChange,
} from "./share.svelte.js";

const KEY = "yours.ledger.v1"; // unrelated to "trophy"
const SALT = "yours.home/trophies/v1";

export const TROPHIES = [
  {
    id: "first-light",
    icon: "☀",
    c: "var(--gold)",
    name: "first light",
    hint: "come in",
    desc: "you arrived. the room turned its lights on for you.",
  },
  {
    id: "sun-worshipper",
    icon: "✦",
    c: "var(--gold)",
    name: "sun worshipper",
    hint: "the sun can be poked",
    desc: "three pokes at the sun. it noticed.",
  },
  {
    id: "leaf-picker",
    icon: "❧",
    c: "var(--leaf)",
    name: "leaf picker",
    hint: "a small leaf, down below",
    desc: "three taps on the leaf. something opened.",
  },
  {
    id: "konami",
    icon: "↑",
    c: "var(--magenta)",
    name: "up up down down",
    hint: "the oldest code there is",
    desc: "you typed the konami code from memory. respect.",
  },
  {
    id: "vine-diver",
    icon: "★",
    c: "var(--lime)",
    name: "vine diver",
    hint: "find the hidden level",
    desc: "you found VINE.EXE.",
  },
  {
    id: "vine-grower",
    icon: "✿",
    c: "var(--lime)",
    name: "vine grower",
    hint: "grow ten suns tall",
    desc: "ten suns in a single run.",
  },
  {
    id: "vine-legend",
    icon: "♛",
    c: "var(--gold)",
    name: "vine legend",
    hint: "grow twenty-five suns tall",
    desc: "twenty-five suns. the vine remembers.",
  },
  {
    id: "synth-finder",
    icon: "♪",
    c: "var(--cyan)",
    name: "synth finder",
    hint: "type the word",
    desc: "you opened synth.exe.",
  },
  {
    id: "tape-deck",
    icon: "●",
    c: "var(--magenta)",
    name: "tape deck",
    hint: "record something",
    desc: "you cut a take on the tape.",
  },
  {
    id: "composer",
    icon: "▶",
    c: "var(--cyan)",
    name: "composer",
    hint: "play it back",
    desc: "you performed your own take.",
  },
  {
    id: "loop-master",
    icon: "↻",
    c: "var(--violet)",
    name: "loop master",
    hint: "let it go round",
    desc: "you set the tape to loop.",
  },
  {
    id: "cat-person",
    icon: "☘",
    c: "var(--leaf)",
    name: "cat person",
    hint: "the cat knows things",
    desc: "you asked the cat for a fact.",
  },
  {
    id: "cat-napper",
    icon: "↔",
    c: "var(--leaf)",
    name: "cat napper",
    hint: "the cat can be moved",
    desc: "you picked the cat up and put it down elsewhere.",
  },
  {
    id: "note-taker",
    icon: "✎",
    c: "var(--gold)",
    name: "note taker",
    hint: "there is a notebook on the left",
    desc: "you wrote something in the notebook.",
  },
  {
    id: "time-capsule",
    icon: "✉",
    c: "var(--gold)",
    name: "time capsule",
    hint: "leave something for later",
    desc: "you sealed a note until a future day.",
  },
  {
    id: "note-passer",
    icon: "➤",
    c: "var(--gold)",
    name: "note passer",
    hint: "pass a note to a stranger",
    desc: "you sent a sticky note to someone you will never meet.",
  },
  {
    id: "note-received",
    icon: "▤",
    c: "var(--cyan)",
    name: "a note for you",
    hint: "someone might write back",
    desc: "a stranger left you a sticky note.",
  },
  {
    id: "wild-one",
    icon: "◓",
    c: "var(--lime)",
    name: "wild one",
    hint: "something rustles in the grass",
    desc: "you rolled a wild encounter.",
  },
  {
    id: "shiny",
    icon: "✨",
    c: "var(--gold)",
    name: "shiny",
    hint: "one in four thousand and ninety-six",
    desc: "you met a shiny. genuinely rare.",
  },
  {
    id: "legendary",
    icon: "☄",
    c: "var(--gold)",
    name: "legendary",
    hint: "the old stories are true",
    desc: "you met a legendary.",
  },
  {
    id: "mythical",
    icon: "✧",
    c: "var(--magenta)",
    name: "mythical",
    hint: "only ever rumoured",
    desc: "you met a mythical.",
  },
  {
    id: "baby",
    icon: "☺",
    c: "var(--cyan)",
    name: "baby",
    hint: "small, and new",
    desc: "you met a baby pokémon.",
  },
  {
    id: "full-party",
    icon: "◉",
    c: "var(--magenta)",
    name: "full party",
    hint: "six of them",
    desc: "your party is full.",
  },
  {
    id: "nicknamer",
    icon: "♥",
    c: "var(--magenta)",
    name: "nicknamer",
    hint: "a party member can be named",
    desc: "you gave one of them a name of your own.",
  },
  {
    id: "guess-first",
    icon: "?",
    c: "var(--cyan)",
    name: "guess who",
    hint: "name it before you look",
    desc: "you guessed a pokémon's name from its silhouette.",
  },
  {
    id: "guess-right",
    icon: "✓",
    c: "var(--lime)",
    name: "sharp eye",
    hint: "get one right",
    desc: "you named a pokémon from its silhouette.",
  },
  {
    id: "guess-streak-5",
    icon: "⚡",
    c: "var(--gold)",
    name: "silhouette streak",
    hint: "five in a row",
    desc: "five silhouettes named in a row.",
  },
  {
    id: "guess-streak-10",
    icon: "✶",
    c: "var(--violet)",
    name: "who's that pokémon?",
    hint: "ten in a row",
    desc: "ten silhouettes named in a row. one a day, mind.",
  },
  {
    id: "dex-10",
    icon: "▦",
    c: "var(--leaf)",
    name: "field notes",
    hint: "meet ten of them",
    desc: "ten pokémon in the dex.",
  },
  {
    id: "dex-50",
    icon: "▦",
    c: "var(--cyan)",
    name: "naturalist",
    hint: "meet fifty of them",
    desc: "fifty pokémon in the dex.",
  },
  {
    id: "dex-100",
    icon: "▦",
    c: "var(--violet)",
    name: "professor",
    hint: "meet a hundred of them",
    desc: "a hundred pokémon in the dex. one a day, mind.",
  },
  {
    id: "dex-caught-10",
    icon: "◍",
    c: "var(--lime)",
    name: "collector",
    hint: "swap them out over time",
    desc: "ten different pokémon have passed through your party.",
  },
  {
    id: "trivia-first",
    icon: "?",
    c: "var(--violet)",
    name: "curious",
    hint: "there is a question waiting",
    desc: "you answered a trivia question.",
  },
  {
    id: "trivia-correct",
    icon: "✓",
    c: "var(--lime)",
    name: "right",
    hint: "get one right",
    desc: "you answered a question correctly.",
  },
  {
    id: "trivia-streak",
    icon: "⚡",
    c: "var(--gold)",
    name: "on a roll",
    hint: "five in a row",
    desc: "five correct answers in a row.",
  },
  {
    id: "trivia-both",
    icon: "⇄",
    c: "var(--cyan)",
    name: "both kinds",
    hint: "two kinds of question",
    desc: "you answered a multiple-choice and a true/false question.",
  },
  {
    id: "trivia-hard",
    icon: "☠",
    c: "var(--magenta)",
    name: "hard mode",
    hint: "the hard ones count too",
    desc: "you got a hard question right.",
  },
  {
    id: "trivia-scholar",
    icon: "✚",
    c: "var(--violet)",
    name: "scholar",
    hint: "ten right in one sitting",
    desc: "ten correct answers in a single visit.",
  },
  {
    id: "trivia-regular",
    icon: "✶",
    c: "var(--gold)",
    name: "regular",
    hint: "come back three days running",
    desc: "three days in a row, you answered one right.",
  },
  {
    id: "weather-watcher",
    icon: "☁",
    c: "var(--cyan)",
    name: "weather watcher",
    hint: "what is it like outside?",
    desc: "you asked the sky what it was doing.",
  },
  {
    id: "customizer",
    icon: "⚙",
    c: "var(--violet)",
    name: "customizer",
    hint: "change the colours",
    desc: "you repainted the room.",
  },
  {
    id: "architect",
    icon: "↓",
    c: "var(--gold)",
    name: "architect",
    hint: "keep a copy",
    desc: "you downloaded your config.",
  },
  {
    id: "night-owl",
    icon: "☾",
    c: "var(--violet)",
    name: "night owl",
    hint: "the small hours",
    desc: "you came in between midnight and five.",
  },
  {
    id: "weight-watcher",
    icon: "⚖",
    c: "var(--leaf)",
    name: "weight watcher",
    hint: "how heavy is this page?",
    desc: "you checked the page against itself.",
  },
  {
    id: "music",
    icon: "♫",
    c: "var(--violet)",
    name: "your own music",
    hint: "the deck can play yours",
    desc: "you played your own music in the room.",
  },
  {
    id: "doodle-first",
    icon: "✎",
    c: "var(--magenta)",
    name: "doodler",
    hint: "there is a pad to draw on",
    desc: "you drew something.",
  },
  {
    id: "doodle-eraser",
    icon: "◻",
    c: "var(--cyan)",
    name: "second thoughts",
    hint: "the eraser works too",
    desc: "you rubbed something out.",
  },
  {
    id: "tip-jar",
    // the cup carries a text-presentation selector (U+FE0E) so it takes
    // the palette colour instead of rendering as a colour emoji
    icon: "☕︎",
    c: "var(--magenta)",
    name: "tip jar",
    hint: "the room has a coffee fund",
    desc: "you bought the room a coffee.",
  },
];

const IDS = new Set(TROPHIES.map((t) => t.id));

const known = (id) => typeof id === "string" && IDS.has(id);

/* ---------- load & save ---------- */

// the payload is a signed string, so the ids are not even a readable
// array in devtools. a bad signature means tampering: we trust nothing
// and fall back rather than honour a hand-edited entry.
async function load() {
  let raw = null;
  try {
    raw = JSON.parse(readStore(KEY) || "null");
  } catch {
    raw = null;
  }

  if (raw && typeof raw === "object" && typeof raw.d === "string") {
    const sig = await hmac(raw.d, SALT);
    if (sig === null || same(sig, raw.s)) {
      let ids = null;
      try {
        ids = JSON.parse(raw.d);
      } catch {
        ids = null;
      }
      if (Array.isArray(ids)) return ids.filter(known);
    }
  }

  return [];
}

async function save() {
  // never write before the stored list has been merged in, or an unlock
  // in the first moments would clobber what was already there
  await ready;
  const d = JSON.stringify([...unlocked]);
  const s = await hmac(d, SALT);
  writeStore(KEY, JSON.stringify({ d, s }));
}

/* ---------- the list ---------- */

export const unlocked = $state([]);

// Hydration is async — the list is signed, and the HMAC is async — so an
// unlock in the first moments (the weather cache, the small-hours visit)
// can arrive before the stored list has landed. Those are queued and
// decided once it does, so a trophy already in storage does not fire a
// second time. Before this, `unlock` saw an empty list and toasted again
// on every load.
let hydrated = false;
const pending = new Set();

function fire(id) {
  window.dispatchEvent(
    new CustomEvent("trophy:unlocked", {
      detail: TROPHIES.find((t) => t.id === id),
    }),
  );
}

// hydrate once, merging rather than replacing, so anything unlocked in
// the moment before this lands is kept.
function settle(ids) {
  for (const id of ids) if (!unlocked.includes(id)) unlocked.push(id);
  hydrated = true;
  let changed = false;
  for (const id of pending) {
    if (!unlocked.includes(id)) {
      unlocked.push(id);
      changed = true;
      fire(id);
    }
  }
  pending.clear();
  if (changed) save();
}

const ready = load()
  .then(settle)
  .catch(() => settle([]));

// entering or leaving guest mode swaps the whole list: the sharer's
// trophies while visiting, the visitor's own again on the way home
onGuestChange(async () => {
  const ids = await load().catch(() => []);
  unlocked.splice(0, unlocked.length, ...ids);
  hydrated = true;
});

export function has(id) {
  return unlocked.includes(id);
}

// returns true only the first time, so a caller can rely on it
export function unlock(id) {
  if (!IDS.has(id)) return false;
  // a guest is only looking: nothing they do here is written down
  if (isGuest()) return false;
  if (!hydrated) {
    // the stored list is still on its way; hold the intent and let
    // hydration decide, so a trophy already earned does not fire again
    if (unlocked.includes(id) || pending.has(id)) return false;
    pending.add(id);
    return true;
  }
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  save();
  fire(id);
  return true;
}
