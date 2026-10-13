<script>
  import { onMount } from "svelte";
  import { config } from "./config.svelte.js";
  import { plainClick } from "./scroll.js";

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
      <span class="meta__sun" title="100% renewable daydreams">☀ solar</span>
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
  }
</style>
