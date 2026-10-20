// ============================================================
// the config
//
// Everything on this page that can be made "yours" lives in one
// deep-reactive object. Components read it directly, so a field
// changes and the page changes with it — no props to thread.
//
// It is kept in localStorage under a single key, exported as a
// small json file, re-imported, or thrown away. A config file
// never leaves the browser unless the person asks it to.
// ============================================================

import { THEMES } from "./theme.js";
import { isValidLink } from "./music.js";
import { share, onGuestChange } from "./share.svelte.js";

const KEY = "yours.config";
const VERSION = 1;

// the two list fields' caps, shared with the settings window so the
// editor and the sanitiser can never disagree about how much fits
export const MARQUEE_MAX = 12;
export const NOW_MAX = 8;

const DEFAULTS = {
  version: VERSION,
  identity: {
    title: "yours",
    name: "YOURS",
    slogan: "a small room on the web",
    tagline:
      "this is not a portfolio. it is *a room* — built by hand, kept small, and in no hurry at all.",
    status: "status: online · nothing here is in a hurry",
  },
  welcome: {
    heading: "you are safe here",
    body: [
      "whoever you are, whatever you carried in — set it down.",
      "this page does not track you, does not sell you, does not want",
      "your email address. it only wants to be a nice place to sit.",
      "",
      "look around. press the ♪. pick up the cat. type the word and a",
      "small instrument appears. then change whatever you like: every",
      "word and colour here can be yours, and it will remember. nothing",
      "you do leaves this browser unless you ask it to.",
    ].join("\n"),
  },
  marquee: [
    "you are welcome here",
    "no trackers · no cookies · no dark patterns",
    "powered by sunshine & stubbornness",
    "best viewed with curiosity",
    "this page listens to you",
    "under permanent construction",
  ],
  now: [
    ["sitting with", "a warm cup"],
    ["reading", "the web, slowly"],
    ["listening", "rain on a tin roof"],
    ["mood", "☀ unhurried"],
  ],
  arrival: {
    play: false,
  },
  // the deck's one tape: a link the visitor pasted, kept as
  // { platform, kind, id } and never as a raw url
  music: { platform: "", kind: "", id: "" },
  theme: "sunrise",
  // the room follows the visitor's clock — dawn, day, dusk, night
  lighting: true,
  // the ko-fi tip jar in the top bar. on by default; a visitor can
  // hide it, and that choice is theirs to keep.
  kofi: true,
};

// the sections that carry a _ □ ✕ cluster, and the three states each can
// be in: open, reduced to its bar, or closed (brought back from settings)
export const WINDOW_IDS = [
  "welcome",
  "encounter",
  "doodle",
  "trivia",
  "fingerprint",
  "news",
];
const WINDOW_STATES = ["open", "min", "closed"];
export { WINDOW_STATES };

/* ---------- sanitising ----------
   A config file can come from anywhere, so nothing is trusted:
   unknown keys are dropped, strings are capped and stripped of
   control characters, and the theme has to be one we know.      */

// single-line field: no newlines, no control characters, capped. the
// slice comes first so a hostile import is bounded before it is processed
function line(v, max, fallback) {
  if (typeof v !== "string") return fallback;
  const s = v
    .slice(0, max * 2)
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, " ")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085\u2028\u2029]/g,
      "",
    )
    .slice(0, max)
    .trim();
  return s || fallback;
}

// multi-line field: keeps its own line breaks, still capped
function block(v, max, fallback) {
  if (typeof v !== "string") return fallback;
  const s = v
    .slice(0, max * 2)
    .replace(/\r\n?/g, "\n")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085\u2028\u2029]/g,
      "",
    )
    .slice(0, max)
    .trim();
  return s || fallback;
}

// list of single lines. An array that happens to be empty is kept as an
// empty list — clearing a field in the UI is a choice.
function list(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return null;
  const out = v
    .slice(0, maxItems * 4)
    .filter((x) => typeof x === "string")
    .map((x) => line(x, maxLen, ""))
    .filter(Boolean)
    .slice(0, maxItems);
  return out;
}

// list of [label, value] rows
function rows(v, maxItems) {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const row of v.slice(0, maxItems * 4)) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const k = line(row[0], 24, "");
    const val = line(row[1], 48, "");
    if (!k && !val) continue;
    out.push([k, val]);
    if (out.length >= maxItems) break;
  }
  return out;
}

// the deck's music link. it is stored parsed, never as a url, so a
// hand-edited config can only ever point at a real track on a platform
// we know — never at an arbitrary iframe.
function music(v) {
  const empty = { platform: "", kind: "", id: "" };
  if (!v || typeof v !== "object") return empty;
  const link = { platform: v.platform, kind: v.kind, id: v.id };
  if (!isValidLink(link)) return empty;
  return { platform: link.platform, kind: link.kind, id: link.id };
}

// the window states. anything we do not recognise falls back to open, so
// a hand-edited config can never leave a section stuck invisible.
function windows(v) {
  const src = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const out = {};
  for (const id of WINDOW_IDS) {
    out[id] = WINDOW_STATES.includes(src[id]) ? src[id] : "open";
  }
  return out;
}

// the order of the sections. it has to come back a full permutation, so
// anything unknown is dropped and anything missing is slotted back in at
// its default position — a hand-edited config can never lose a section by
// leaving it out, and a newly added window lands where it was designed to
// sit rather than at the very bottom.
function order(v) {
  const seen = new Set();
  const out = [];
  if (Array.isArray(v)) {
    for (const id of v) {
      if (WINDOW_IDS.includes(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  for (const id of WINDOW_IDS) {
    if (seen.has(id)) continue;
    // after the last present section that precedes it in the default order
    const def = WINDOW_IDS.indexOf(id);
    let at = 0;
    for (let i = 0; i < out.length; i++) {
      if (WINDOW_IDS.indexOf(out[i]) < def) at = i + 1;
    }
    out.splice(at, 0, id);
    seen.add(id);
  }
  return out;
}

function sanitize(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const id = r.identity && typeof r.identity === "object" ? r.identity : {};
  const w = r.welcome && typeof r.welcome === "object" ? r.welcome : {};
  const d = DEFAULTS;

  return {
    version: VERSION,
    identity: {
      title: line(id.title, 32, d.identity.title),
      name: line(id.name, 32, d.identity.name),
      slogan: line(id.slogan, 60, d.identity.slogan),
      tagline: line(id.tagline, 260, d.identity.tagline),
      status: line(id.status, 90, d.identity.status),
    },
    welcome: {
      heading: line(w.heading, 60, d.welcome.heading),
      body: block(w.body, 900, d.welcome.body),
    },
    marquee: list(r.marquee, MARQUEE_MAX, 90) ?? [...d.marquee],
    now: rows(r.now, NOW_MAX) ?? d.now.map((p) => [...p]),
    arrival: {
      play: r.arrival?.play === true,
    },
    music: music(r.music),
    windows: windows(r.windows),
    order: order(r.order),
    theme: Object.hasOwn(THEMES, r.theme) ? r.theme : d.theme,
    // on unless a config explicitly turns it off, so an older file
    // (written before this existed) still gets the light
    lighting: r.lighting !== false,
    // same idea: the tip jar is on unless a config says otherwise
    kofi: r.kofi !== false,
  };
}

/* ---------- loading & saving ---------- */

function stored() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The visitor's own config, read from localStorage. When a share link
// is open, this is stashed in `mine` and the live object is seeded from
// the sharer's config instead — so the page renders their room, while
// the visitor's own config is never touched on disk.
const local = sanitize(stored());
let mine = share.payload ? local : null;

export const config = $state(
  share.payload ? sanitize(share.payload.config) : local,
);

// a runtime change of guest mode (go home / make it mine) has to swap
// the live object, since components bind straight to it
onGuestChange(() => {
  if (share.payload) {
    if (!mine) mine = JSON.parse(JSON.stringify(config));
    applyInto(config, sanitize(share.payload.config));
  } else if (mine) {
    applyInto(config, mine);
    mine = null;
  }
});

// "make it mine": keep the guest config as ours, so leaving guest mode
// does not swap it back out from under the visitor
export function adoptGuestConfig() {
  mine = JSON.parse(JSON.stringify(config));
}

let timer;
let pending = null;
// The caller hands us a snapshot it already took (which is what makes
// the $effect in App subscribe to every field), and we debounce the
// write so typing doesn't hammer localStorage.
export function persist(snapshot) {
  pending = snapshot;
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}

// write the pending snapshot now — used by the debounce and by pagehide,
// so an edit made just before the tab closes is not lost
function flush() {
  clearTimeout(timer);
  if (pending === null || share.payload) return;
  try {
    localStorage.setItem(KEY, pending);
  } catch {
    /* private mode or a full quota — changes still apply, they just
       won't outlive the tab */
  }
  pending = null;
}

if (typeof window !== "undefined") window.addEventListener("pagehide", flush);

export function storageAvailable() {
  try {
    localStorage.setItem("__home_probe__", "1");
    localStorage.removeItem("__home_probe__");
    return true;
  } catch {
    return false;
  }
}

/* ---------- import / export / reset ---------- */

const KNOWN = [
  "identity",
  "welcome",
  "marquee",
  "now",
  "arrival",
  "music",
  "windows",
  "order",
  "theme",
  "lighting",
  "kofi",
];

function applyInto(target, next) {
  for (const k of Object.keys(next)) target[k] = next[k];
  for (const k of Object.keys(target)) if (!(k in next)) delete target[k];
}

export function resetConfig() {
  applyInto(config, sanitize(null));
}

export function importConfig(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "that file isn't json." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "that file isn't a config." };
  }
  // a bare `{}` would silently wipe everything, so insist on at least
  // one recognisable section before we replace what is already there
  if (!KNOWN.some((k) => Object.hasOwn(raw, k))) {
    return { ok: false, error: "that doesn't look like a home config." };
  }
  applyInto(config, sanitize(raw));
  return { ok: true };
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// a plain snapshot — the proxies stringify fine, but this keeps the
// download free of anything that isn't part of the config
function configJSON() {
  return JSON.stringify(
    {
      ...config,
      version: VERSION,
      exported: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  );
}

export function exportConfig() {
  const blob = new Blob([configJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(config.identity.title) || "home"}.config.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
