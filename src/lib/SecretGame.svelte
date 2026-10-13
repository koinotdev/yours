<script>
  import { onMount } from "svelte";
  import { unlock } from "./achievements.svelte.js";
  import { readStore, writeStore, share } from "./share.svelte.js";
  import { lockScroll, unlockScroll } from "./scroll-lock.js";
  import { trapFocus } from "./focus-trap.js";

  let { onClose } = $props();

  /* ---------- world ---------- */
  const COLS = 22;
  const ROWS = 22;
  const CELL = 22;
  const W = COLS * CELL;
  const H = ROWS * CELL;

  /* ---------- reactive ui state ---------- */
  let canvas;
  let ctx;
  let phase = $state("idle"); // idle | playing | paused | over
  let score = $state(0);
  let best = $state(0);
  let newBest = $state(false); // this run beat the stored best

  /* ---------- plain game state (mutated every frame) ---------- */
  let snake = [];
  let prev = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let stepMs = 135;
  let acc = 0;
  let last = 0;
  let raf = 0;
  let reduced = false;

  // the game is painted from the live theme rather than a copy of it, so
  // changing the theme re-tints the snake, the sun and the floor too. the
  // rgb triples below are only the sunrise fallbacks, used before the first
  // frame reads the real values off :root.
  let HEAD_RGB = [182, 255, 61];
  let TAIL_RGB = [26, 122, 66];
  let GOLD_RGB = [255, 201, 60];
  let ORANGE_RGB = [255, 122, 61];
  let LEAF_RGB = [46, 230, 107];
  let BG_RGB = [7, 11, 9];
  let ON_ACCENT_RGB = [4, 20, 10];
  let paletteTheme = null;

  // resolve a theme variable to an rgb triple through the browser, so it
  // works whatever the value is written as (hex, hsl, color-mix, ...)
  function readColor(name, fallback) {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const parts = computed.match(/\d+/g);
    if (!parts || parts.length < 3) return fallback;
    return [+parts[0], +parts[1], +parts[2]];
  }

  // re-read the palette only when the theme actually changes; the data
  // attribute is set by applyTheme and is cheap to poll once per frame
  function refreshPalette() {
    const theme = document.documentElement.dataset.theme ?? "";
    if (theme === paletteTheme) return;
    paletteTheme = theme;
    HEAD_RGB = readColor("--lime", [182, 255, 61]);
    LEAF_RGB = readColor("--leaf", [46, 230, 107]);
    GOLD_RGB = readColor("--gold", [255, 201, 60]);
    ORANGE_RGB = readColor("--orange", [255, 122, 61]);
    BG_RGB = readColor("--bg", [7, 11, 9]);
    ON_ACCENT_RGB = readColor("--on-accent", [4, 20, 10]);
    // the tail is the body colour folded into the dark, as before
    TAIL_RGB = LEAF_RGB.map((c) => Math.round(c * 0.53));
  }

  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function mix(c1, c2, t) {
    return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(
      lerp(c1[2], c2[2], t),
    )})`;
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    food = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
  }

  function reset() {
    const cy = Math.floor(ROWS / 2);
    snake = [
      { x: 6, y: cy },
      { x: 5, y: cy },
      { x: 4, y: cy },
    ];
    prev = snake.map((s) => ({ ...s }));
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    newBest = false;
    stepMs = 135;
    acc = 0;
    placeFood();
    phase = "playing";
  }

  function queueDir(x, y) {
    if (x === -dir.x && y === -dir.y) return;
    nextDir = { x, y };
  }

  function step() {
    dir = nextDir;
    const old = snake.map((s) => ({ ...s }));
    const head = {
      x: (snake[0].x + dir.x + COLS) % COLS,
      y: (snake[0].y + dir.y + ROWS) % ROWS,
    };
    const willGrow = head.x === food.x && head.y === food.y;
    const body = willGrow ? snake : snake.slice(0, -1);

    if (body.some((s) => s.x === head.x && s.y === head.y)) {
      phase = "over";
      return;
    }

    snake = [head, ...body];
    prev = snake.map((_, i) => old[i] ?? old[old.length - 1] ?? { ...head });

    if (willGrow) {
      score += 1;
      if (score >= 10) unlock("vine-grower");
      if (score >= 25) unlock("vine-legend");
      if (score > best) {
        best = score;
        newBest = true;
        writeStore("vine.best", String(best));
      }
      stepMs = Math.max(62, 135 - score * 3.2);
      placeFood();
    }
  }

  /* ---------- rendering ---------- */
  function drawSun(cx, cy, t) {
    const pulse = reduced ? 0 : Math.sin(t / 260) * 1.6;
    const r = CELL * 0.3 + pulse;

    ctx.save();
    ctx.shadowColor = rgba(GOLD_RGB, 0.9);
    ctx.shadowBlur = 22;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    // mix() already returns a css rgb() string — wrapping it in rgb() again
    // would index the string's characters and yield the literal "rgb(r,g,b)"
    g.addColorStop(0, mix(GOLD_RGB, [255, 255, 255], 0.74));
    g.addColorStop(0.5, rgb(GOLD_RGB));
    g.addColorStop(1, rgb(ORANGE_RGB));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = rgba(GOLD_RGB, 0.75);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (reduced ? 0 : t / 1400);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3));
      ctx.lineTo(cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7));
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw(t) {
    if (!ctx) return;
    refreshPalette();
    ctx.clearRect(0, 0, W, H);

    // floor
    ctx.fillStyle = rgb(BG_RGB);
    ctx.fillRect(0, 0, W, H);

    // grid dots
    ctx.fillStyle = rgba(LEAF_RGB, 0.1);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillRect(
          x * CELL + CELL / 2 - 0.5,
          y * CELL + CELL / 2 - 0.5,
          1,
          1,
        );
      }
    }

    // food
    drawSun(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, t);

    if (!snake.length) return;

    const f = phase === "playing" ? Math.min(1, acc / stepMs) : 1;
    const n = snake.length;

    for (let i = n - 1; i >= 0; i--) {
      const cur = snake[i];
      const p = prev[i] ?? cur;
      let px = p.x;
      let py = p.y;
      if (Math.abs(cur.x - p.x) <= 1 && Math.abs(cur.y - p.y) <= 1) {
        px = p.x + (cur.x - p.x) * f;
        py = p.y + (cur.y - p.y) * f;
      }

      const x = px * CELL + 1.5;
      const y = py * CELL + 1.5;
      const s = CELL - 3;
      const col = mix(HEAD_RGB, TAIL_RGB, n === 1 ? 0 : i / (n - 1));

      ctx.save();
      if (i === 0) {
        ctx.shadowColor = rgba(HEAD_RGB, 0.85);
        ctx.shadowBlur = 16;
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, i === 0 ? 7 : 5);
      ctx.fill();
      ctx.restore();

      // head eyes
      if (i === 0) {
        ctx.fillStyle = rgb(ON_ACCENT_RGB);
        const ex = x + s / 2;
        const ey = y + s / 2;
        const off = 3.6;
        const ox = dir.y !== 0 ? off : 0;
        const oy = dir.x !== 0 ? off : 0;
        ctx.beginPath();
        ctx.arc(ex - ox + dir.x * 2, ey - oy + dir.y * 2, 1.7, 0, Math.PI * 2);
        ctx.arc(ex + ox + dir.x * 2, ey + oy + dir.y * 2, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (!last) last = t;
    const dt = Math.min(80, t - last);
    last = t;

    if (phase === "playing") {
      acc += dt;
      let guard = 0;
      while (acc >= stepMs && phase === "playing" && guard++ < 4) {
        acc -= stepMs;
        step();
      }
    }
    draw(t);
  }

  /* ---------- input ---------- */
  const KEYMAP = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    s: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    W: [0, -1],
    S: [0, 1],
    A: [-1, 0],
    D: [1, 0],
  };

  function onKey(e) {
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
    ) {
      e.preventDefault();
    }
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "r" || e.key === "R") {
      if (phase === "over" || phase === "paused") reset();
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      if (phase === "idle" || phase === "over") reset();
      else if (phase === "playing") phase = "paused";
      else if (phase === "paused") phase = "playing";
      return;
    }
    const v = KEYMAP[e.key];
    if (v) {
      if (phase === "idle") reset();
      if (phase === "playing" || phase === "paused") queueDir(v[0], v[1]);
    }
  }

  function press(x, y) {
    if (phase === "idle" || phase === "over") reset();
    queueDir(x, y);
  }

  // entering or leaving guest mode swaps the high score for the sharer's
  $effect(() => {
    share.payload;
    const stored = Number(readStore("vine.best"));
    best = Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
  });

  onMount(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // a gentle starting position so the idle screen isn't empty
    const cy = Math.floor(ROWS / 2);
    snake = [
      { x: 6, y: cy },
      { x: 5, y: cy },
      { x: 4, y: cy },
    ];
    prev = snake.map((s) => ({ ...s }));
    placeFood();

    raf = requestAnimationFrame(frame);
    window.addEventListener("keydown", onKey);
    lockScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  });
</script>

<div
  class="veil"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div
    class="cab"
    role="dialog"
    aria-modal="true"
    aria-label="VINE.EXE hidden game"
    tabindex="-1"
    use:trapFocus
  >
    <div class="cab__bar">
      <span class="cab__title">VINE.EXE — hidden level</span>
      <span class="cab__spacer"></span>
      <span class="cab__tag">16-bit</span>
      <button class="cab__x" onclick={onClose} aria-label="close game">✕</button
      >
    </div>

    <div class="cab__screen">
      <canvas
        bind:this={canvas}
        style="width:{W}px;height:{H}px"
        aria-label="game canvas"
      ></canvas>

      <div class="cab__crt" aria-hidden="true"></div>

      {#if phase !== "playing"}
        <div class="over">
          {#if phase === "idle"}
            <p class="over__kicker">you found it</p>
            <h3 class="over__title">VINE.EXE</h3>
            <p class="over__text">
              grow the vine. eat the sun. don't bite yourself.<br />
              the edges wrap around — the world is round here.
            </p>
            <p class="over__cta">press <kbd>space</kbd> or tap to grow</p>
          {:else if phase === "paused"}
            <h3 class="over__title over__title--sm">PAUSED</h3>
            <p class="over__cta">press <kbd>space</kbd> to resume</p>
          {:else if phase === "over"}
            <p class="over__kicker over__kicker--bad">
              segmentation fault (core dumped)
            </p>
            <h3 class="over__title over__title--sm">GAME OVER</h3>
            <p class="over__text">
              you grew <strong>{score}</strong> suns tall.
              {#if newBest}new personal best!{/if}
            </p>
            <p class="over__cta">press <kbd>R</kbd> to regrow</p>
          {/if}
        </div>
      {/if}
    </div>

    <div class="cab__hud">
      <span class="hud__item"
        >score <b>{String(score).padStart(3, "0")}</b></span
      >
      <span class="hud__item">hi <b>{String(best).padStart(3, "0")}</b></span>
      <span class="hud__spacer"></span>
      <span class="hud__keys"
        >↑↓←→ / wasd · space pause · R restart · esc exit</span
      >
    </div>

    <div class="cab__pad">
      <button
        class="pad pad--up"
        onpointerdown={() => press(0, -1)}
        aria-label="up">▲</button
      >
      <button
        class="pad pad--left"
        onpointerdown={() => press(-1, 0)}
        aria-label="left">◀</button
      >
      <button
        class="pad pad--down"
        onpointerdown={() => press(0, 1)}
        aria-label="down">▼</button
      >
      <button
        class="pad pad--right"
        onpointerdown={() => press(1, 0)}
        aria-label="right">▶</button
      >
    </div>
  </div>
</div>

<style>
  .veil {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: grid;
    place-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(6px);
    animation: fade 0.2s ease;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  .cab {
    width: min(520px, 100%);
    max-height: 96vh;
    overflow: auto;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line-hot);
    border-radius: 12px;
    box-shadow:
      0 0 0 1px #000,
      0 0 60px -10px color-mix(in srgb, var(--leaf) 35%, transparent),
      0 30px 60px -30px #000;
    animation: pop 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  @keyframes pop {
    from {
      transform: scale(0.94) translateY(8px);
      opacity: 0;
    }
  }

  .cab__bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
  }
  .cab__title {
    font-family: var(--pixel);
    font-size: 19px;
    letter-spacing: 0.05em;
    color: var(--lime);
    text-shadow: var(--glow-lime);
  }
  .cab__spacer {
    flex: 1;
  }
  .cab__tag {
    font-family: var(--pixel);
    font-size: 16px;
    color: var(--gold);
    border: 1px solid var(--line-hot);
    border-radius: 4px;
    padding: 0 6px;
  }
  .cab__x {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--orange) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--orange) 50%, transparent);
    border-radius: 6px;
    color: var(--orange);
    font-size: 12px;
    transition: background 0.15s ease;
  }
  .cab__x:hover {
    background: color-mix(in srgb, var(--orange) 30%, transparent);
  }

  .cab__screen {
    position: relative;
    display: grid;
    place-items: center;
    padding: 14px;
    background: var(--bg);
  }
  canvas {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    box-shadow:
      0 0 0 1px var(--line),
      0 0 40px -12px color-mix(in srgb, var(--lime) 40%, transparent);
  }

  .cab__crt {
    position: absolute;
    inset: 14px;
    border-radius: 6px;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.28) 0 1px,
        transparent 1px 3px
      ),
      radial-gradient(120% 100% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.5));
    opacity: 0.6;
  }

  .over {
    position: absolute;
    inset: 14px;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 8px;
    padding: 20px;
    text-align: center;
    border-radius: 6px;
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(2px);
  }
  .over__kicker {
    margin: 0;
    font-family: var(--pixel);
    font-size: 20px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold);
    text-shadow: var(--glow-gold);
  }
  .over__kicker--bad {
    color: var(--orange);
    text-shadow: 0 0 8px color-mix(in srgb, var(--orange) 60%, transparent);
  }
  .over__title {
    margin: 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: clamp(30px, 8vw, 44px);
    letter-spacing: -0.02em;
    background: linear-gradient(100deg, var(--lime), var(--leaf), var(--cyan));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .over__title--sm {
    font-size: clamp(24px, 6vw, 32px);
    background: linear-gradient(100deg, var(--gold), var(--orange));
    -webkit-background-clip: text;
    background-clip: text;
  }
  .over__text {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.7;
    color: var(--ink-dim);
  }
  .over__text strong {
    color: var(--lime);
  }
  .over__cta {
    margin: 6px 0 0;
    font-size: 11.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  kbd {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--lime);
    background: color-mix(in srgb, var(--lime) 10%, transparent);
    border: 1px solid var(--line-hot);
    border-radius: 4px;
    padding: 1px 6px;
  }

  .cab__hud {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .hud__item b {
    font-family: var(--pixel);
    font-size: 20px;
    font-weight: 400;
    color: var(--lime);
    text-shadow: var(--glow-lime);
    margin-left: 4px;
  }
  .hud__spacer {
    flex: 1;
  }
  .hud__keys {
    font-size: 10px;
    color: var(--ink-faint);
  }

  .cab__pad {
    display: none;
    grid-template-columns: repeat(3, 46px);
    grid-template-rows: repeat(2, 46px);
    justify-content: center;
    gap: 6px;
    padding: 0 14px 16px;
  }
  .pad {
    display: grid;
    place-items: center;
    font-size: 14px;
    color: var(--lime);
    background: color-mix(in srgb, var(--lime) 8%, transparent);
    border: 1px solid var(--line-hot);
    border-radius: 8px;
    touch-action: manipulation;
  }
  .pad:active {
    background: color-mix(in srgb, var(--lime) 25%, transparent);
  }
  .pad--up {
    grid-column: 2;
    grid-row: 1;
  }
  .pad--left {
    grid-column: 1;
    grid-row: 2;
  }
  .pad--down {
    grid-column: 2;
    grid-row: 2;
  }
  .pad--right {
    grid-column: 3;
    grid-row: 2;
  }

  @media (hover: none), (max-width: 640px) {
    .cab__pad {
      display: grid;
    }
    .hud__keys {
      display: none;
    }
  }
</style>
