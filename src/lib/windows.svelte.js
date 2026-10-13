// ============================================================
// the section windows
//
// Every panel on the page carries the little _ □ ✕ cluster, and
// now they do something: reduce to the bar, restore, or close.
//
// The state lives in the config, so it is remembered, travels
// with an exported "home", and — the point of it — a closed
// section can always be brought back from settings.cfg.
// ============================================================

import { config, WINDOW_IDS, WINDOW_STATES } from "./config.svelte.js";

// the panel titles, so settings.cfg can name what it is restoring
export const WINDOW_LABELS = {
  welcome: "welcome.txt",
  news: "whats_new.txt",
  encounter: "wild_encounter.dat",
  doodle: "doodle.dat",
  trivia: "trivia.dat",
  fingerprint: "fingerprint.txt",
};

export function windowState(id) {
  return config.windows?.[id] ?? "open";
}

export function setWindow(id, state) {
  if (!WINDOW_IDS.includes(id) || !WINDOW_STATES.includes(state)) return;
  config.windows[id] = state;
}

// swap two sections in the column. the drag gesture moves a window one
// neighbour at a time, so this is all it ever needs.
export function swapWindows(a, b) {
  const list = config.order;
  const i = list.indexOf(a);
  const j = list.indexOf(b);
  if (i < 0 || j < 0 || i === j) return;
  list[i] = b;
  list[j] = a;
}

// put the column back the way it was built
export function resetOrder() {
  config.order = [...WINDOW_IDS];
}
