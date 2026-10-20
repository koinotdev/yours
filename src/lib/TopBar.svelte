<script>
  import { onMount } from "svelte";
  import { config } from "./config.svelte.js";
  import { plainClick } from "./scroll.js";
  import { KOFI_URL } from "./kofi.js";
  import { unlock } from "./achievements.svelte.js";

  let { onSettings, onHome } = $props();

  // the brand means "go home" in both views: on the synth page that is
  // a view swap, on the home page it is a scroll to the top. either way
  // the address bar is left alone.
  function goHome(e) {
    if (!plainClick(e)) return;
    e.preventDefault();
    onHome();
  }

  let clock = $state("--:--:--");

  onMount(() => {
    const tick = () => {
      const d = new Date();
      clock = d.toLocaleTimeString("en-GB", { hour12: false });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  });
</script>

<header class="bar">
  <div class="wrap bar__in">
    <a class="brand" href="#top" onclick={goHome}>
      <span class="led"></span>
      <span class="brand__txt"
        >{config.identity.title}<span class="brand__slash">://</span>home</span
      >
    </a>

    <span class="bar__tag">{config.identity.slogan}</span>

    <div class="meta">
      <button class="cfg" onclick={onSettings} title="make this page yours"
        >⚙ cfg</button
      >
      <span class="meta__clock" title="local time">{clock}</span>
      <span class="meta__sun" title="the light follows your clock">☀ solar</span>
      {#if config.kofi && KOFI_URL}
        <a
          class="kofi"
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="buy me a coffee on ko-fi"
          aria-label="buy me a coffee on ko-fi"
          onclick={() => unlock("tip-jar")}
        >
          <span class="kofi__cup" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
              <path
                d="M2.5 6.2h8v3.3a3.1 3.1 0 0 1-3.1 3.1H5.6a3.1 3.1 0 0 1-3.1-3.1z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              />
              <path
                d="M10.5 7.3h1.1a1.7 1.7 0 0 1 0 3.4h-1.1"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span class="kofi__txt">ko-fi</span>
        </a>
      {/if}
    </div>
  </div>
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 50;
    /* no backdrop-filter: a blur on a sticky element has to re-sample
       everything behind it on every frame, and this page animates a
       lot behind it. a near-opaque fill reads the same and costs
       nothing. */
    background: color-mix(in srgb, var(--bg) 94%, transparent);
    border-bottom: 1px solid var(--line);
  }

  .bar__in {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 52px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: var(--ink);
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .brand:hover {
    text-decoration: none;
    color: var(--ink);
  }
  .brand__slash {
    color: var(--lime);
  }

  .bar__tag {
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-left: auto;
    font-size: 11px;
    color: var(--ink-faint);
    white-space: nowrap;
  }
  .meta__clock {
    font-family: var(--pixel);
    font-size: 19px;
    color: var(--cyan);
    text-shadow: var(--glow-cyan);
  }
  .meta__sun {
    color: var(--gold);
  }

  /* the tip jar: a plain link, styled like the cfg button so it reads as
     part of the same little control strip. no third-party code, and
     nothing is requested until it is clicked. */
  .kofi {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--magenta);
    background: color-mix(in srgb, var(--magenta) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--magenta) 45%, transparent);
    border-radius: 3px;
    transition:
      background 0.18s ease,
      box-shadow 0.18s ease;
  }
  .kofi:hover {
    color: var(--magenta);
    text-decoration: none;
    background: color-mix(in srgb, var(--magenta) 20%, transparent);
    box-shadow: 0 0 16px -3px
      color-mix(in srgb, var(--magenta) 70%, transparent);
  }
  /* the cup is drawn, not an emoji: a colour emoji would ignore the
     palette, and this takes the button's own colour instead */
  .kofi__cup {
    display: flex;
    flex: none;
  }

  .cfg {
    padding: 3px 8px;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--leaf);
    background: color-mix(in srgb, var(--leaf) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--leaf) 45%, transparent);
    border-radius: 3px;
    transition:
      background 0.18s ease,
      box-shadow 0.18s ease;
  }
  .cfg:hover {
    background: color-mix(in srgb, var(--leaf) 20%, transparent);
    box-shadow: 0 0 16px -3px color-mix(in srgb, var(--leaf) 70%, transparent);
  }

  @media (max-width: 560px) {
    .bar__tag {
      display: none;
    }
    /* the strip is tight on a phone: pull it in, and let the tip jar
       drop to just its cup */
    .meta {
      gap: 8px;
    }
    .kofi__txt {
      display: none;
    }
    .kofi {
      padding: 3px 6px;
    }
  }
</style>
