<script>
  import { onMount } from "svelte";
  import { config } from "./config.svelte.js";

  let { onDone } = $props();

  // derived, so a guest link that lands a moment after boot still shows
  // the sharer's name rather than the visitor's
  const lines = $derived([
    `${config.identity.name.toUpperCase()}-OS v3.11  (c) 1996—2026`,
    "POST ......................... OK",
    "mount /dev/sun ............... OK",
    "water /var/plants ............ OK",
    "load vibes.ko ................ OK",
    "start httpd .................. OK",
    "",
    "> welcome, traveler. take your time.",
  ]);

  let shown = $state([]);
  let progress = $state(0);
  let leaving = $state(false);
  let finished = $state(false);
  let ready = $state(false);

  let doneTimer = 0;
  function finish() {
    if (finished) return;
    finished = true;
    leaving = true;
    doneTimer = setTimeout(onDone, 460);
  }

  onMount(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < lines.length) {
        shown = [...shown, lines[i]];
        progress = Math.round(((i + 1) / lines.length) * 100);
        i++;
      } else {
        clearInterval(timer);
        ready = true;
      }
    }, 120);

    // the page waits for you now. space, enter, or a click — and that
    // first gesture is also what lets the arrival greeting start its
    // audio, which browsers otherwise refuse to do on their own.
    const enter = (e) => {
      if (e.type === "keydown") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
      }
      finish();
    };
    window.addEventListener("keydown", enter);
    window.addEventListener("click", enter);
    return () => {
      clearInterval(timer);
      clearTimeout(doneTimer);
      window.removeEventListener("keydown", enter);
      window.removeEventListener("click", enter);
    };
  });
</script>

<div class="boot" class:leaving>
  <div class="boot__inner">
    <pre class="boot__log">{shown.join("\n")}<span class="cursor"></span></pre>

    <div class="boot__meter">
      <div class="boot__track"><i style="width:{progress}%"></i></div>
      <span class="boot__pct">{progress}%</span>
    </div>

    <p class="boot__hint" class:ready>press space to enter</p>
  </div>
</div>

<style>
  .boot {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 50% 40%, var(--bg-2), var(--bg) 70%);
    transition:
      opacity 0.45s ease,
      filter 0.45s ease;
  }
  .boot.leaving {
    opacity: 0;
    filter: blur(6px);
    pointer-events: none;
  }

  .boot__inner {
    width: min(560px, 86vw);
  }

  .boot__log {
    margin: 0 0 20px;
    font-family: var(--mono);
    font-size: clamp(11px, 2.6vw, 14px);
    line-height: 1.7;
    color: var(--leaf);
    text-shadow: 0 0 10px color-mix(in srgb, var(--leaf) 35%, transparent);
    white-space: pre-wrap;
    min-height: 12em;
  }

  .boot__meter {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .boot__track {
    flex: 1;
    height: 10px;
    border: 1px solid var(--line-hot);
    border-radius: 99px;
    background: var(--well);
    overflow: hidden;
  }
  .boot__track i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--leaf), var(--lime), var(--gold));
    box-shadow: var(--glow-lime);
    transition: width 0.12s linear;
  }
  .boot__pct {
    font-family: var(--pixel);
    font-size: 20px;
    color: var(--gold);
    min-width: 3.4em;
    text-align: right;
  }

  .boot__hint {
    margin: 18px 0 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    transition: color 0.3s ease;
  }
  .boot__hint.ready {
    color: var(--lime);
    text-shadow: var(--glow-lime);
    animation: hint 1.6s ease-in-out infinite;
  }
  @keyframes hint {
    50% {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .boot__hint.ready {
      animation: none;
    }
  }
</style>
