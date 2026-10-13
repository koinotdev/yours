<script>
  import { onMount } from "svelte";
  import catWalk from "../images/cat-walk.gif";
  import catRun from "../images/cat-run.gif";
  import { unlock } from "./achievements.svelte.js";
  import { readStore, writeStore, share } from "./share.svelte.js";

  // A cat that lives in the bottom-right corner. The art is two GIFs —
  // walk and run — made transparent and optimised ahead of time. Mostly
  // it pads along in place; every so often it breaks into a run for a
  // second or two. Click it and it tells you a cat fact: one tiny
  // request, only when asked. Pick it up and you can drop it anywhere.

  let pose = $state("walk");

  // --- drag & drop ---------------------------------------------------
  // Anchored bottom-right until you pick it up, then it gets an explicit
  // position and stays where you drop it. It is anchored by its BOTTOM
  // edge, so the taller run sprite grows upward instead of sinking into
  // the floor, and the speech bubble keeps a stable height above it.
  const POS_KEY = "cat.pos";

  let placed = $state(false);
  let dragging = $state(false);
  let x = $state(0);
  let y = $state(0);
  let catEl;
  let grab = null;
  let moved = false;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

  function clampIntoView() {
    if (!placed || !catEl) return;
    const rect = catEl.getBoundingClientRect();
    x = clamp(x, 0, Math.max(0, window.innerWidth - rect.width));
    y = clamp(y, 0, Math.max(0, window.innerHeight - rect.height));
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    grab = {
      id: e.pointerId,
      px: e.clientX,
      py: e.clientY,
      ox: e.clientX - rect.left,
      oy: rect.bottom - e.clientY,
      w: rect.width,
      h: rect.height,
    };
    moved = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!grab || e.pointerId !== grab.id) return;
    // a few pixels of slop so a click never turns into a drag
    if (!moved && Math.hypot(e.clientX - grab.px, e.clientY - grab.py) < 4)
      return;
    moved = true;
    dragging = true;
    closeBubble();
    x = clamp(e.clientX - grab.ox, 0, Math.max(0, window.innerWidth - grab.w));
    y = clamp(
      window.innerHeight - (e.clientY + grab.oy),
      0,
      Math.max(0, window.innerHeight - grab.h),
    );
    placed = true;
  }

  function onPointerUp(e) {
    if (!grab || e.pointerId !== grab.id) return;
    dragging = false;
    grab = null;
    if (moved) {
      unlock("cat-napper");
      writeStore(POS_KEY, JSON.stringify({ x, y }));
    }
  }

  // a cancelled drag must clear `moved`, or the next real click is swallowed
  function onPointerCancel(e) {
    if (!grab || e.pointerId !== grab.id) return;
    dragging = false;
    grab = null;
    moved = false;
  }

  function onCatClick() {
    // a drag ends with a click event; swallow it so dropping the cat
    // doesn't also ask it for a fact
    const wasDrag = moved;
    moved = false;
    if (wasDrag) return;
    meow();
  }

  function loadPos() {
    try {
      const saved = JSON.parse(readStore(POS_KEY) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        x = saved.x;
        y = saved.y;
        placed = true;
        requestAnimationFrame(clampIntoView);
      } else {
        placed = false;
      }
    } catch {
      /* ignore a corrupt or unreadable entry */
    }
  }

  // entering or leaving guest mode moves the cat to the sharer's spot
  $effect(() => {
    share.payload;
    loadPos();
  });

  onMount(() => {
    window.addEventListener("resize", clampIntoView);
    return () => window.removeEventListener("resize", clampIntoView);
  });

  // --- the idle loop -------------------------------------------------
  onMount(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Warm the run sprite once the page is idle so the first burst
    // doesn't flash an empty frame. This is off the critical path, but
    // it is still a real request: the badge's PerformanceObserver counts
    // it in the "other" bucket on a cold load. That is honest — the
    // bytes did cross the wire — so we do not try to hide it.
    const warm = () => {
      new Image().src = catRun;
    };
    let cancelWarm = () => {};
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      cancelWarm = () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(warm, 2500);
      cancelWarm = () => clearTimeout(id);
    }

    let alive = true;
    let timer;
    const schedule = () => {
      timer = setTimeout(
        () => {
          if (!alive) return;
          pose = "run";
          timer = setTimeout(
            () => {
              if (!alive) return;
              pose = "walk";
              schedule();
            },
            2000 + Math.random() * 1500,
          );
        },
        5000 + Math.random() * 11000,
      );
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
      cancelWarm();
      clearTimeout(bubbleTimer);
    };
  });

  // --- the cat fact --------------------------------------------------
  let fact = $state("");
  let loading = $state(false);
  let open = $state(false);
  let bubbleTimer;

  function closeBubble() {
    clearTimeout(bubbleTimer);
    open = false;
  }

  async function meow() {
    unlock("cat-person");
    open = true;
    loading = true;
    clearTimeout(bubbleTimer);
    try {
      const res = await fetch("https://catfact.ninja/fact", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      fact = (await res.json()).fact;
    } catch {
      fact = "the cat is offline — probably napping in a sunbeam.";
    } finally {
      loading = false;
      bubbleTimer = setTimeout(() => (open = false), 11000);
    }
  }
</script>

<div class="catlayer">
  <div
    class="cat"
    class:placed
    class:dragging
    class:pose-run={pose === "run"}
    bind:this={catEl}
    style="--x: {x}px; --y: {y}px"
  >
    <button
      class="cat__btn"
      onclick={onCatClick}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerCancel}
      title="psst — the cat knows things"
      aria-label="ask the cat for a cat fact"
    >
      <img
        class="cat__gif"
        src={pose === "run" ? catRun : catWalk}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
    </button>

    {#if open}
      <div class="bubble" role="status">
        <span class="bubble__tag">cat fact</span>
        <p class="bubble__text">{loading ? "…" : fact}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .catlayer {
    position: fixed;
    inset: 0;
    z-index: 55;
    pointer-events: none;
  }

  .cat {
    /* --cath is the walk sprite's height on screen. The walk GIF is a
       72x60 canvas whose art fills it edge to edge, so this is also the
       cat's height. Everything else — the run scale, the foot offset,
       the bubble position — is derived from it. */
    --cath: 32px;
    position: absolute;
    right: 14px;
    bottom: 0;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Once dropped, the cat is positioned from its bottom-left corner. */
  .cat.placed {
    right: auto;
    left: 0;
    transform: translate(var(--x), calc(-1 * var(--y)));
  }

  .cat__btn {
    position: relative;
    isolation: isolate;
    display: block;
    padding: 0;
    background: none;
    border: 0;
    line-height: 0;
    pointer-events: auto;
    touch-action: none;
    cursor: grab;
  }
  .cat.dragging .cat__btn {
    cursor: grabbing;
  }

  /* A soft glow behind the sprite. It used to be a drop-shadow filter on
     the <img>, but a filter on a looping GIF is re-rasterised on every
     decoded frame — a static radial gradient gives the same halo for
     free. */
  .cat__btn::before {
    content: "";
    position: absolute;
    inset: -10px;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--leaf) 45%, transparent),
      transparent
    );
    opacity: 0.55;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }
  .cat.dragging .cat__btn::before {
    opacity: 1;
  }

  .cat__gif {
    display: block;
    height: var(--cath);
    width: auto;
    image-rendering: pixelated;
  }

  /* The run sprite is a taller canvas (80x68) and its feet sit 4px above
     the bottom edge, so keep the same 4x pixel scale and drop it those
     4px to hold the cat on the same ground line. */
  .pose-run .cat__gif {
    height: calc(var(--cath) * 68 / 60);
    transform: translateY(calc(var(--cath) * 4 / 60));
  }

  /* --- the speech bubble, anchored right so it never leaves the screen --- */
  .bubble {
    position: absolute;
    bottom: calc(var(--cath) + 10px);
    right: 0;
    width: max-content;
    max-width: min(280px, 74vw);
    padding: 9px 12px;
    background: var(--panel-2);
    border: 1px solid var(--line-hot);
    border-radius: 4px;
    box-shadow:
      0 0 0 1px #000,
      0 14px 30px -20px #000,
      0 0 24px -10px color-mix(in srgb, var(--leaf) 60%, transparent);
    animation: bubble-in 0.18s ease;
  }
  .bubble::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 22px;
    border: 6px solid transparent;
    border-top-color: var(--line-hot);
  }
  .bubble__tag {
    display: block;
    margin-bottom: 3px;
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--leaf);
    text-shadow: var(--glow-lime);
  }
  .bubble__text {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--ink);
  }

  @keyframes bubble-in {
    from {
      opacity: 0;
      translate: 0 6px;
    }
  }

  @media (max-width: 620px) {
    .cat {
      --cath: 24px;
      right: 10px;
    }
  }
</style>
