<script>
  import { openSecret } from "./secret.js";
  import { config } from "./config.svelte.js";
  import { unlock } from "./achievements.svelte.js";
  import Weather from "./Weather.svelte";

  // a very quiet nod to the old web: the little sun is clickable
  let taps = 0;
  function pokeSun() {
    taps++;
    if (taps >= 3) {
      taps = 0;
      unlock("sun-worshipper");
      openSecret();
    }
  }

  // the tagline is plain text except for *starred* words, which get
  // tinted. splitting on the stars is enough — svelte escapes the rest.
  const tagline = $derived(
    config.identity.tagline
      .split("*")
      .map((seg, i) => ({ seg, hot: i % 2 === 1 })),
  );
</script>

<section class="mast" id="top">
  <div class="mast__in">
    <button
      class="sun"
      onclick={pokeSun}
      title="just a sun"
      aria-label="a small sun"
    >
      <svg viewBox="0 0 240 240" role="presentation">
        <defs>
          <radialGradient id="sunG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" class="sun-glow sun-glow--core" />
            <stop offset="45%" class="sun-glow sun-glow--mid" />
            <stop offset="100%" class="sun-glow sun-glow--edge" />
          </radialGradient>
        </defs>

        <!-- rays -->
        <g class="rays" stroke-width="3" stroke-linecap="round">
          <line x1="120" y1="14" x2="120" y2="40" />
          <line x1="120" y1="200" x2="120" y2="226" />
          <line x1="14" y1="120" x2="40" y2="120" />
          <line x1="200" y1="120" x2="226" y2="120" />
          <line x1="45" y1="45" x2="63" y2="63" />
          <line x1="177" y1="177" x2="195" y2="195" />
          <line x1="195" y1="45" x2="177" y2="63" />
          <line x1="63" y1="177" x2="45" y2="195" />
        </g>

        <!-- sun -->
        <circle cx="120" cy="120" r="52" fill="url(#sunG)" />
        <circle
          class="sun-ring"
          cx="120"
          cy="120"
          r="52"
          fill="none"
          stroke-width="1.5"
          opacity="0.6"
        />

        <!-- vine ring -->
        <g class="vine" fill="none" stroke-width="3" stroke-linecap="round">
          <path
            d="M120 62 C 168 62 196 92 196 120 C 196 158 162 186 120 186 C 78 186 44 158 44 120 C 44 92 72 62 120 62"
          />
        </g>
        <g class="leaves">
          <ellipse
            cx="196"
            cy="120"
            rx="9"
            ry="5"
            transform="rotate(-20 196 120)"
          />
          <ellipse
            cx="44"
            cy="120"
            rx="9"
            ry="5"
            transform="rotate(20 44 120)"
          />
          <ellipse cx="120" cy="186" rx="5" ry="9" />
          <ellipse cx="120" cy="62" rx="5" ry="9" />
        </g>
      </svg>
    </button>

    <div class="mast__copy">
      <p class="mast__kicker">~/index.html · est. 1996 · rebuilt 2026</p>

      <h1 class="name">
        <span class="name__glitch" aria-hidden="true"
          >{config.identity.name}</span
        >
        <span class="name__real">{config.identity.name}</span>
      </h1>

      <p class="mast__tag">
        {#each tagline as part}{#if part.hot}<span class="hl">{part.seg}</span
            >{:else}{part.seg}{/if}{/each}
      </p>
    </div>

    <div class="mast__wx"><Weather /></div>
  </div>

  <p class="mast__status">
    <span class="led"></span>
    {config.identity.status} · <span class="cursor"></span>
  </p>
</section>

<style>
  .mast {
    position: relative;
    z-index: 1;
    padding-block: clamp(26px, 5vw, 48px) clamp(18px, 3vw, 28px);
  }

  .mast__in {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: clamp(18px, 3.5vw, 40px);
    align-items: center;
  }

  /* the weather bug rides the whole header row rather than the title
     line, so it never stretches the name or pushes the tagline down */
  .mast__wx {
    justify-self: end;
  }

  .name {
    position: relative;
    margin: 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: clamp(48px, 11vw, 116px);
    line-height: 0.9;
    letter-spacing: -0.045em;
    color: var(--ink);
  }
  .name__real {
    position: relative;
    z-index: 2;
    background: linear-gradient(
      100deg,
      var(--lime) 0%,
      var(--leaf) 32%,
      var(--cyan) 68%,
      var(--gold) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(
      0 0 26px color-mix(in srgb, var(--leaf) 28%, transparent)
    );
  }
  .name__glitch {
    position: absolute;
    inset: 0;
    z-index: 1;
    color: var(--magenta);
    opacity: 0;
    pointer-events: none;
    mix-blend-mode: screen;
  }
  .name:hover .name__glitch {
    opacity: 0.9;
    animation: glitch 0.5s steps(2) infinite;
  }
  @keyframes glitch {
    0% {
      transform: translate(0, 0);
      clip-path: inset(0 0 62% 0);
      color: var(--magenta);
    }
    25% {
      transform: translate(-4px, 2px);
      clip-path: inset(38% 0 24% 0);
      color: var(--cyan);
    }
    50% {
      transform: translate(4px, -2px);
      clip-path: inset(70% 0 6% 0);
      color: var(--lime);
    }
    75% {
      transform: translate(-3px, 1px);
      clip-path: inset(12% 0 55% 0);
      color: var(--gold);
    }
    100% {
      transform: translate(0, 0);
      clip-path: inset(0 0 62% 0);
      color: var(--magenta);
    }
  }

  .mast__kicker {
    margin: 0 0 8px;
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold);
    text-shadow: var(--glow-gold);
  }

  .mast__tag {
    max-width: 52ch;
    margin: 12px 0 18px;
    font-size: clamp(13.5px, 1.5vw, 15.5px);
    color: var(--ink-dim);
  }
  .hl {
    color: var(--lime);
  }

  .mast__status {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 22px 0 0;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  /* --- art --- */
  .sun {
    position: relative;
    isolation: isolate;
    width: clamp(92px, 13vw, 148px);
    padding: 0;
    background: none;
    border: 0;
  }
  /* the halo is a static gradient rather than a drop-shadow filter: the
     rays and vine inside spin forever, and a filter over an animating
     subtree is re-rasterised on every frame */
  .sun::before {
    content: "";
    position: absolute;
    inset: -16%;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--gold) 22%, transparent),
      transparent
    );
    pointer-events: none;
  }
  .sun svg {
    width: 100%;
    height: auto;
  }
  .rays {
    stroke: var(--gold);
    transform-origin: 120px 120px;
    animation: spin 46s linear infinite;
  }
  .vine {
    stroke: var(--leaf);
    transform-origin: 120px 120px;
    animation: spin 60s linear infinite reverse;
  }
  .leaves {
    fill: var(--lime);
    animation: breathe 4.5s ease-in-out infinite;
    transform-origin: 120px 120px;
  }
  /* the sun keeps its gold-to-orange identity, but derived from the
     palette so a theme swap re-tints it along with everything else */
  .sun-glow--core {
    stop-color: color-mix(in srgb, var(--gold) 33%, #fff);
  }
  .sun-glow--mid {
    stop-color: var(--gold);
  }
  .sun-glow--edge {
    stop-color: var(--orange);
  }
  .sun-ring {
    stroke: color-mix(in srgb, var(--gold) 33%, #fff);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes breathe {
    0%,
    100% {
      opacity: 0.75;
    }
    50% {
      opacity: 1;
    }
  }

  /* the name needs the room, so the weather drops to its own row
     before the three columns start to squeeze */
  @media (max-width: 820px) {
    .mast__in {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .mast__wx {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }

  @media (max-width: 620px) {
    .mast__in {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .sun {
      width: 84px;
    }
  }
</style>
