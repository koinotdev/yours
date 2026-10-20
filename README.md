<div align="center">

# YOURS

**A small, hopeful, hand-built corner of the web.**

Not a portfolio. A safe space on the web — vibrant neon on a deep dark
background, with a solarpunk heart, and a settings file, because a place only
feels like yours when you can rearrange the furniture.

[![License: GPL-3.0](https://img.shields.io/github/license/koinotdev/yours?color=b6ff3d&label=license)](LICENSE)
[![Built with Svelte](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Bundled with Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![No trackers](https://img.shields.io/badge/trackers-none-b6ff3d)](docs/GUIDE.md#fingerprinttxt)

</div>

<!--
  A screenshot (or a short screen recording) is the single best thing a visitor
  can see first. Drop one in docs/ and uncomment the line below:

  ![YOURS home](docs/screenshot.png)
-->

## What is this?

**YOURS** is an open-source personal homepage — a love letter to the web as it
was shaped from 1996 to 2003, when a homepage was a *place* rather than a
landing page. It is a frameset of dense, bordered, always-visible windows: a
persistent left rail beside a scrolling column, a fake `YOURS-OS` boot screen, a
scrolling marquee, and a room whose light follows your clock.

It began as a portfolio. It is not one any more. The goal of this repo is to be a
**safe, private, and genuinely yours** corner of the web that anyone can fork,
rearrange, and make their own:

- **Yours to change.** Almost every word and colour comes from one config object,
  editable live from `settings.cfg` — no save button, no round trip. Five palettes,
  your own name, slogan, marquee, and welcome note.
- **Private by default.** No trackers, no cookies, and no requests on page load.
  The config lives in `localStorage` and never leaves the browser. There is even a
  `fingerprint.txt` window that shows you exactly what a tracker *could* learn —
  and then tells you none of it left the tab.
- **Small on purpose.** A static page, ~93 kB gzipped, self-hosted fonts, no
  framework beyond Svelte. It ships as a tiny nginx image and idles at ~8 MB.
- **A little hacky, on purpose.** There are secrets hidden in it. Go looking.

## Highlights

- **Boot screen** — a fake `YOURS-OS` POST sequence that types itself out and waits for a keypress.
- **The light** — the room follows your clock: warm at dawn, clear by day, magenta at dusk, deep violet at night.
- **`welcome.txt`** — a note to whoever arrives, and a warm nod to how long you have been gone.
- **`wild_encounter.dat`** + **`pokedex.dat`** — one random Pokémon a day, met as a silhouette, kept in a party of six.
- **`doodle.dat`** — a drawing pad that stores *strokes*, so your drawing retints with the theme.
- **The cassette deck** — plays *your* music, framing YouTube only after you press play.
- **The notebook** — private notes with pages you can *seal* until a future day.
- **The sticky notes** — pass one anonymous note a day, browser to browser, no server.
- **The trophy cabinet** — it watches what you do here and keeps its own list.
- **Two secrets** — `VINE.EXE` (a minimal game) and `synth.exe` (a tiny Web Audio synth). Good luck finding them.

Every window carries a working `_ □ ✕` cluster and can be dragged up or down the
column. The order is kept in your config.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
```

Build and preview the static output:

```sh
npm run build    # static output in dist/
npm run preview  # serve the build
```

## Deploy it

The page is fully static, so hosting it is just "serve some files". The included
`Dockerfile` builds the app once and ships only nginx plus the built output —
nothing runs node at runtime.

```sh
docker build -t yours-home .
docker run --rm -p 8080:80 yours-home
```

It also drops straight onto any static host or PaaS. See the
[guide](docs/GUIDE.md#deploy-it) for the details.

## Contributing

**Pull requests are very welcome.** This is a small, hand-built thing, and it
gets better every time someone brings a new idea, a fix, or a fresh pair of eyes.

Ways to help:

- **Fix a bug** or polish something rough.
- **Add a widget** — a new window in the same spirit.
- **Improve accessibility** — focus handling, reduced motion, contrast, keyboard paths.
- **Trim the weight** — the fonts are the biggest lever left.
- **Improve the docs** — including this README.

Before you open a PR:

1. Fork the repo and branch off `main`.
2. Keep changes focused and in the existing style (plain CSS, no new framework).
3. Run `npm run format` and make sure `npm run build` passes.
4. Describe *what* changed and *why* in the PR.

Found a bug or have an idea? [Open an issue](https://github.com/koinotdev/yours/issues) —
no idea is too small.

## Star history

If this project is useful or just makes you smile, a star helps others find it.

[![Star History Chart](https://api.star-history.com/svg?repos=koinotdev/yours&type=Date)](https://star-history.com/#koinotdev/yours&Date)

## License

GPL-3.0 — see [LICENSE](LICENSE). Take it, fork it, make it yours.

---

<sub>Want the full tour — every window, widget, and secret, and the reasoning
behind them? Read the [guide](docs/GUIDE.md).</sub>
