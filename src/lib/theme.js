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

// paint a palette onto :root. Unknown ids fall back to sunrise, so a
// hand-edited config file can never leave the page colourless.
export function applyTheme(id) {
  const key = Object.hasOwn(THEMES, id) ? id : "sunrise";
  const root = document.documentElement;
  for (const [name, value] of Object.entries(THEMES[key].vars)) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = key;
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
