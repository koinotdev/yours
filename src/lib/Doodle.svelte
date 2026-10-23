<script>
  // doodle.dat — a small canvas you can draw on, kept in this browser.
  //
  // The drawing is stored as *strokes*, not as an image: a list of
  // points in 0..1 space, plus a colour token and a width. That keeps
  // the payload small, and because the points are normalised the
  // doodle survives a resize. Colours are stored as palette *tokens*
  // (lime, cyan, …) and resolved to the live theme value at draw time,
  // so changing the theme retints the drawing with the room.
  //
  // Nothing here is signed: it is your own art, and there is nothing
  // to cheat. It lives under `yours.doodle`, its own key, so exporting
  // your "home" never carries it out.

  import { onMount } from "svelte";
  import { getStroke } from "perfect-freehand";
  import { config } from "./config.svelte.js";
  import { paletteSignature } from "./theme.js";
  import { unlock } from "./achievements.svelte.js";
  import { readStore, writeStore, share } from "./share.svelte.js";
  import { windowState } from "./windows.svelte.js";
  import WinBtns from "./WinBtns.svelte";

  const KEY = "yours.doodle";
  const MAX_STROKES = 600;
  const MAX_POINTS = 4000;

  const PALETTE = [
    { id: "lime", label: "lime" },
    { id: "cyan", label: "cyan" },
    { id: "gold", label: "gold" },
    { id: "magenta", label: "magenta" },
    { id: "violet", label: "violet" },
    { id: "ink", label: "ink" },
  ];
  const SIZES = [
    { id: 2, label: "thin" },
    { id: 5, label: "medium" },
    { id: 11, label: "thick" },
  ];

  let wrap;
  let canvas;
  let ctx = null;
  // committed strokes are kept on an offscreen canvas, so the live
  // stroke can be re-rendered on every move without repainting the
  // whole drawing. `base` is that canvas, blitted under the live one.
  let base = null;
  let bctx = null;
  let size = { w: 0, h: 0 };

  // a plain array, not $state: a few thousand points would be proxied
  // deeply, and the canvas is redrawn by hand anyway. `count` is the
  // reactive shadow the UI reads.
  let strokes = [];
  let count = $state(0);

  let color = $state("lime");
  let width = $state(5);
  let erasing = $state(false);
  let confirming = $state(false);
  let note = $state("");

  let drawing = null; // the stroke in progress
  let saveTimer;
  let confirmTimer;

  // resolve a palette token to the live theme colour. getComputedStyle is
  // expensive and paint() runs on every pointermove, so the resolved
  // colours are cached and dropped whenever the theme changes.
  //
  // We resolve through a probe element rather than reading the custom
  // property directly: getPropertyValue() hands back the raw token stream
  // (e.g. `hsl(var(--sh) 60% 92%)` for --ink), which canvas cannot parse
  // and silently ignores. Setting `color: var(--x)` and reading the
  // computed colour forces the browser to resolve nested var()/hsl()/
  // color-mix() into a real `rgb(...)` string.
  const colorCache = new Map();
  function resolve(token) {
    let v = colorCache.get(token);
    if (v === undefined) {
      const name = token === "ink" ? "--ink" : `--${token}`;
      const probe = document.createElement("span");
      probe.style.color = `var(${name})`;
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).color;
      probe.remove();
      v = computed && computed !== "rgba(0, 0, 0, 0)" ? computed : "#ffffff";
      colorCache.set(token, v);
    }
    return v;
  }

  // a stored stroke is only trusted as far as it looks like one
  function cleanStroke(s) {
    if (!s || typeof s !== "object" || !Array.isArray(s.pts)) return null;
    const pts = s.pts
      .filter(
        (p) =>
          Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
      )
      .map(([x, y]) => [
        Math.min(1, Math.max(0, x)),
        Math.min(1, Math.max(0, y)),
      ])
      .slice(0, MAX_POINTS);
    if (!pts.length) return null;
    const c = PALETTE.some((p) => p.id === s.c) ? s.c : "lime";
    const w = Number.isFinite(s.w) ? Math.min(24, Math.max(1, s.w)) : 5;
    return { c, w, e: s.e === true, pts };
  }

  function load() {
    try {
      const raw = JSON.parse(readStore(KEY) || "null");
      const list = Array.isArray(raw) ? raw : raw?.s;
      if (!Array.isArray(list)) return [];
      return list.map(cleanStroke).filter(Boolean).slice(-MAX_STROKES);
    } catch {
      return [];
    }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      writeStore(KEY, JSON.stringify({ v: 1, s: strokes }));
    }, 400);
  }

  function resize() {
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = { w: rect.width, h: rect.height };
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!base) base = document.createElement("canvas");
    base.width = w;
    base.height = h;
    bctx = base.getContext("2d");
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  // perfect-freehand turns the raw points into a filled outline with a
  // speed-based taper, so a stroke reads as ink rather than a wire. It
  // works in the same units as the points, so we hand it pixels — the
  // stored points stay normalised, and only the render scales them.
  function outline(s, last) {
    const pts = s.pts.map(([nx, ny]) => [nx * size.w, ny * size.h]);
    return getStroke(pts, {
      size: s.w,
      thinning: 0.55,
      smoothing: 0.5,
      streamline: 0.5,
      last,
    });
  }

  function paint(target, s, last) {
    if (!target || !s.pts.length) return;
    const poly = outline(s, last);
    if (!poly.length) return;
    target.save();
    target.globalCompositeOperation = s.e ? "destination-out" : "source-over";
    target.fillStyle = resolve(s.c);
    target.beginPath();
    poly.forEach(([x, y], i) =>
      i ? target.lineTo(x, y) : target.moveTo(x, y),
    );
    target.closePath();
    target.fill();
    target.restore();
  }

  // the committed drawing lives on `base`; the visible canvas is that
  // blitted down, with the in-progress stroke painted on top.
  function blit() {
    if (!ctx || !base) return;
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.drawImage(base, 0, 0, size.w, size.h);
  }

  function redraw() {
    if (!ctx || !bctx) return;
    bctx.clearRect(0, 0, size.w, size.h);
    for (const s of strokes) paint(bctx, s, true);
    blit();
  }

  function point(e) {
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    ];
  }

  function down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    drawing = { c: color, w: width, e: erasing, pts: [point(e)] };
    blit();
    paint(ctx, drawing, false);
    if (erasing) unlock("doodle-eraser");
    else unlock("doodle-first");
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = point(e);
    const last = drawing.pts[drawing.pts.length - 1];
    // skip points a hair apart, so a slow hand does not bloat the
    // payload with thousands of near-identical points
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004) return;
    drawing.pts.push(p);
    // the outline of the live stroke changes as points are added, so
    // re-blit the committed drawing and repaint just this stroke
    blit();
    paint(ctx, drawing, false);
  }

  function up(e) {
    if (!drawing) return;
    canvas.releasePointerCapture?.(e.pointerId);
    strokes.push(drawing);
    if (strokes.length > MAX_STROKES) strokes = strokes.slice(-MAX_STROKES);
    drawing = null;
    count = strokes.length;
    // commit the finished stroke (with its end cap) to the base canvas
    redraw();
    save();
  }

  function undo() {
    if (!strokes.length) return;
    strokes.pop();
    count = strokes.length;
    redraw();
    save();
  }

  // two taps rather than a native confirm(), which would break the spell
  function clear() {
    if (!confirming) {
      confirming = true;
      note = "tap again to clear it all";
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => {
        confirming = false;
        note = "";
      }, 4000);
      return;
    }
    clearTimeout(confirmTimer);
    strokes = [];
    count = 0;
    confirming = false;
    note = "";
    redraw();
    save();
  }

  function savePng() {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "doodle.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  onMount(() => {
    strokes = load();
    count = strokes.length;
    resize();
    const ro = new ResizeObserver(resize);
    if (wrap) ro.observe(wrap);
    return () => {
      ro.disconnect();
      clearTimeout(saveTimer);
      clearTimeout(confirmTimer);
    };
  });

  // a theme change retints the strokes, so repaint from the tokens.
  // the signature read is what makes a custom palette edit count too.
  $effect(() => {
    config.theme;
    paletteSignature(config.palette);
    colorCache.clear();
    redraw();
  });

  // a guest link swaps the drawing out from under us
  $effect(() => {
    share.payload;
    strokes = load();
    count = strokes.length;
    redraw();
  });
</script>

<section class="panel" id="doodle" class:min={windowState("doodle") === "min"}>
  <div class="panel__bar">
    <span class="panel__title">doodle.dat</span>
    <WinBtns id="doodle" />
  </div>

  <div class="panel__body doodle">
    <div class="doodle__tools">
      <div class="doodle__group" role="group" aria-label="colour">
        {#each PALETTE as p}
          <button
            class="swatch"
            class:on={!erasing && color === p.id}
            style="--c:var(--{p.id})"
            onclick={() => {
              color = p.id;
              erasing = false;
            }}
            aria-pressed={!erasing && color === p.id}
            title={p.label}
            aria-label={p.label}
          ></button>
        {/each}
      </div>

      <div class="doodle__group" role="group" aria-label="brush size">
        {#each SIZES as s}
          <button
            class="size"
            class:on={width === s.id}
            onclick={() => (width = s.id)}
            aria-pressed={width === s.id}
            title={s.label}>{s.label}</button
          >
        {/each}
      </div>

      <button
        class="tool"
        class:on={erasing}
        onclick={() => (erasing = !erasing)}
        aria-pressed={erasing}>eraser</button
      >
    </div>

    <div class="pad" bind:this={wrap}>
      <canvas
        bind:this={canvas}
        aria-label="a small drawing pad"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
      ></canvas>
    </div>

    <div class="doodle__foot">
      <button class="btn btn--ghost" onclick={undo} disabled={count === 0}
        >↶ undo</button
      >
      <button class="btn btn--magenta" onclick={clear}
        >{confirming ? "really clear?" : "clear"}</button
      >
      <button class="btn btn--ghost" onclick={savePng} disabled={count === 0}
        >↓ save png</button
      >
      <p class="doodle__note">
        {note ||
          (count
            ? `${count} stroke${count === 1 ? "" : "s"} · kept in this browser`
            : "draw something — it stays in this browser")}
      </p>
    </div>
  </div>
</section>

<style>
  .doodle {
    display: grid;
    gap: 10px;
  }

  .doodle__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .doodle__group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .swatch {
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 50%;
    background: var(--c);
    border: 2px solid transparent;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
    transition:
      transform 0.12s ease,
      border-color 0.15s ease;
  }
  .swatch:hover {
    transform: scale(1.15);
  }
  .swatch.on {
    border-color: var(--ink);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.35),
      0 0 10px -1px var(--c);
  }

  .size,
  .tool {
    padding: 3px 8px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-faint);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: 3px;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
  }
  .size:hover,
  .tool:hover {
    color: var(--ink);
    border-color: var(--line-hot);
  }
  .size.on,
  .tool.on {
    color: var(--violet);
    background: color-mix(in srgb, var(--violet) 12%, transparent);
    border-color: color-mix(in srgb, var(--violet) 50%, transparent);
    box-shadow: 0 0 14px -4px color-mix(in srgb, var(--violet) 70%, transparent);
  }
  .tool {
    margin-left: auto;
  }

  .pad {
    position: relative;
    aspect-ratio: 3 / 2;
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
    background:
      linear-gradient(
          to right,
          color-mix(in srgb, var(--leaf) 5%, transparent) 1px,
          transparent 1px
        )
        0 0 / 22px 22px,
      linear-gradient(
          to bottom,
          color-mix(in srgb, var(--leaf) 5%, transparent) 1px,
          transparent 1px
        )
        0 0 / 22px 22px,
      var(--well);
    box-shadow: inset 0 0 40px -18px
      color-mix(in srgb, var(--leaf) 40%, transparent);
    overflow: hidden;
  }
  .pad canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .doodle__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .doodle__foot .btn {
    padding: 6px 11px;
    font-size: 11px;
  }
  .doodle__foot .btn:disabled {
    opacity: 0.4;
    cursor: default;
    transform: none;
    box-shadow: none;
  }
  .doodle__note {
    flex: 1 1 160px;
    margin: 0;
    font-size: 10.5px;
    line-height: 1.6;
    color: var(--ink-faint);
  }
</style>
