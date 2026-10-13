// ============================================================
// How much is this page keeping in your browser?
//
// Everything the page remembers lives in localStorage, and this
// is the ledger: every key it owns, and what each one costs.
//
// localStorage holds strings as UTF-16, so each character is two
// bytes against the browser's quota — the numbers here are twice
// the character count, and the key itself is counted too.
// ============================================================

// the usual per-origin allowance, in bytes. browsers differ (and
// measure it differently), so this is a rough yardstick, not a
// promise.
const BUDGET = 5 * 1000 * 1000;

// friendly names for the keys this page owns. a key from another
// script on the same origin is shown as it is.
const LABELS = {
  "yours.config": "settings.cfg",
  "yours.notes": "the notebook",
  "yours.sticky.key": "sticky notes identity",
  "yours.sticky.state": "sticky notes",
  "yours.weather": "weather.dat",
  "yours.cache.v2": "wild encounter + dex",
  "yours.doodle": "doodle.dat",
  "yours.ledger.v1": "trophy cabinet",
  "yours.seen": "last visit",
  "yours.trivia": "trivia day streak",
  "cat.pos": "the cat",
  "vine.best": "VINE.EXE score",
  "synth.tape": "synth tape",
  "synth.sound": "synth knobs",
  "synth.layout": "synth keys",
};

// `overrides` lets a caller supply the live value of a key that has
// not been written yet (the config is debounced), so the number
// tracks what you are typing rather than what was last flushed.
export function measureStorage(overrides = {}) {
  if (typeof localStorage === "undefined") return null;

  const seen = new Set();
  const entries = [];
  let total = 0;

  const add = (key, value) => {
    const bytes = (key.length + value.length) * 2;
    total += bytes;
    entries.push({ key, label: LABELS[key] ?? key, bytes });
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null || seen.has(key)) continue;
      seen.add(key);
      const value = Object.hasOwn(overrides, key)
        ? overrides[key]
        : (localStorage.getItem(key) ?? "");
      add(key, value);
    }
  } catch {
    // some privacy modes throw on access rather than returning null
    return null;
  }

  // a key that only exists in the overrides (not yet flushed) still counts
  for (const [key, value] of Object.entries(overrides)) {
    if (!seen.has(key)) add(key, value);
  }

  entries.sort((a, b) => b.bytes - a.bytes);
  return { total, entries, budget: BUDGET };
}
