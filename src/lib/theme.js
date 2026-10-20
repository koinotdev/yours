// ============================================================
// themes
//
// A theme re-tints the whole page with eight values: seven accents
// plus the surface hue (--sh) that the backgrounds, panels, borders
// and ink are all built from. Everything else — the glows, the panel
// bars, the badges, the body gradients — is derived from those in
// app.css with color-mix, so a palette is a handful of hex codes.
// No fetching, no generating, no dependencies.
//
// The keys name the roles: --lime is the loud
// accent, --leaf is the growing one, and so on.
// ============================================================

export const THEMES = {
  sunrise: {
    label: "sunrise",
    vars: {
      "--sh": "150",
      "--lime": "#b6ff3d",
      "--leaf": "#2ee66b",
      "--cyan": "#35e6ff",
      "--gold": "#ffc93c",
      "--magenta": "#ff4fd8",
      "--orange": "#ff7a3d",
      "--violet": "#9d7bff",
    },
  },
  tidepool: {
    label: "tidepool",
    vars: {
      "--sh": "176",
      "--lime": "#7dffcf",
      "--leaf": "#21c9a6",
      "--cyan": "#5cc8ff",
      "--gold": "#ffd98a",
      "--magenta": "#ff8fd4",
      "--orange": "#ff9d5c",
      "--violet": "#9fb6ff",
    },
  },
  blossom: {
    label: "blossom",
    vars: {
      "--sh": "285",
      "--lime": "#ff9de0",
      "--leaf": "#c07bff",
      "--cyan": "#7fd8ff",
      "--gold": "#ffd166",
      "--magenta": "#ff6ec7",
      "--orange": "#ff8e6e",
      "--violet": "#d8a8ff",
    },
  },
  ember: {
    label: "ember",
    vars: {
      "--sh": "22",
      "--lime": "#ffc247",
      "--leaf": "#ff7a3d",
      "--cyan": "#5ad1d1",
      "--gold": "#ffe6a0",
      "--magenta": "#ff5f8f",
      "--orange": "#ff8a3d",
      "--violet": "#c79bff",
    },
  },
  midnight: {
    label: "midnight",
    vars: {
      "--sh": "222",
      "--lime": "#a9b8ff",
      "--leaf": "#6ee7d0",
      "--cyan": "#66b3ff",
      "--gold": "#ffd479",
      "--magenta": "#ff8fc7",
      "--orange": "#ffa07a",
      "--violet": "#c0a8ff",
    },
  },
};

export const THEME_IDS = Object.keys(THEMES);

// ---------- the custom palette ----------
//
// A visitor can build their own palette: the same eight values a preset
// carries, but theirs. It lives in the config — so it saves, exports,
// imports and travels in a share link like everything else — under
// `theme: "custom"` plus a `palette` object.
//
// --sh is a bare hue number 0-360; the seven accents are hex. Nothing
// else is accepted, so a hand-edited config or a hostile share link can
// only ever paint a colour — never smuggle in a url() or a stray rule.

export const CUSTOM_ID = "custom";

// the accent roles, in the order the editor shows them, paired with the
// plain word the UI labels each one with.
export const ACCENTS = [
  ["--lime", "loud"],
  ["--leaf", "growing"],
  ["--cyan", "cool"],
  ["--gold", "warm"],
  ["--magenta", "bright"],
  ["--orange", "hot"],
  ["--violet", "soft"],
];

// what a custom palette starts as: the sunrise values, so switching to
// custom is never a jump to nothing.
const SUNRISE = THEMES.sunrise.vars;
export const DEFAULT_PALETTE = {
  "--sh": Number(SUNRISE["--sh"]),
  ...Object.fromEntries(ACCENTS.map(([key]) => [key, SUNRISE[key]])),
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// a whole hue, wrapped into 0-359
function hue(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DEFAULT_PALETTE["--sh"];
  return ((n % 360) + 360) % 360;
}

// keep only what we recognise: a hue number and seven hex accents.
// anything else falls back to the sunrise value for that slot.
export function sanitizePalette(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = { "--sh": hue(p["--sh"]) };
  for (const [key] of ACCENTS) {
    const v = p[key];
    out[key] =
      typeof v === "string" && HEX.test(v.trim())
        ? v.trim().toLowerCase()
        : DEFAULT_PALETTE[key];
  }
  return out;
}

// a short, stable signature of a palette. It becomes the data-theme
// value for a custom theme, so the components that poll that attribute
// (the snake, the doodle) notice when a swatch is edited.
export function paletteSignature(palette) {
  const p = sanitizePalette(palette);
  const s = `${p["--sh"]}|${ACCENTS.map(([key]) => p[key]).join("|")}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// paint a palette onto :root. Unknown ids fall back to sunrise, so a
// hand-edited config file can never leave the page colourless.
export function applyTheme(id, palette) {
  const custom = id === CUSTOM_ID;
  const key = custom || Object.hasOwn(THEMES, id) ? id : "sunrise";
  // read the palette even for a preset: the caller's $effect then
  // subscribes to every value, so editing a swatch re-runs this
  const p = sanitizePalette(palette);
  const vars = custom ? p : THEMES[key].vars;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, String(value));
  }
  root.dataset.theme = custom ? `custom-${paletteSignature(p)}` : key;
  syncThemeColor();
}

// the browser chrome (mobile address bar, etc.) reads <meta theme-color>,
// which cannot see our CSS vars — so mirror the resolved --bg onto it.
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.body).backgroundColor;
  if (bg) meta.setAttribute("content", bg);
}
