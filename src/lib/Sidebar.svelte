<script>
  import { config } from "./config.svelte.js";
  import { windowState } from "./windows.svelte.js";
  import { jump } from "./scroll.js";
  import Trophies from "./Trophies.svelte";

  let { onSettings, onNotes, onStickies } = $props();

  // the site map follows the column: the same order, and nothing that has
  // been closed. these are the short labels.
  const LABELS = {
    welcome: "welcome",
    news: "whats new",
    encounter: "wild encounter",
    doodle: "doodle",
    trivia: "trivia",
    fingerprint: "fingerprint",
  };

  const nav = $derived(
    config.order
      .filter((id) => windowState(id) !== "closed")
      .map((id) => ({ href: `#${id}`, label: LABELS[id] })),
  );
</script>

<aside class="rail" aria-label="Site navigation and status">
  <nav class="box" aria-label="Site map">
    <p class="box__head">site map</p>
    <ul class="box__body nav">
      <li><a href="#top" onclick={jump}>home</a></li>
      {#each nav as n (n.href)}
        <li><a href={n.href} onclick={jump}>{n.label}</a></li>
      {/each}
      <li><button class="nav__cfg" onclick={onNotes}>notes ✎</button></li>
      <li>
        <button class="nav__cfg" onclick={onStickies}>sticky notes ✉</button>
      </li>
      <li>
        <button class="nav__cfg" onclick={onSettings}>customize ⚙</button>
      </li>
    </ul>
  </nav>

  {#if config.now.length}
    <div class="box">
      <p class="box__head" style="--c:var(--leaf)">currently</p>
      <ul class="box__body now">
        {#each config.now as [k, v]}
          <li><span>{k}</span><b>{v}</b></li>
        {/each}
      </ul>
    </div>
  {/if}

  <Trophies />
</aside>

<style>
  .nav {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .nav a {
    display: block;
    padding: 3px 6px;
    font-size: 12.5px;
    color: var(--ink-dim);
    border-left: 2px solid transparent;
  }
  .nav a::before {
    content: "» ";
    color: var(--leaf);
  }
  .nav a:hover {
    color: var(--lime);
    background: color-mix(in srgb, var(--lime) 6%, transparent);
    border-left-color: var(--lime);
    text-decoration: none;
  }

  /* the one entry in the map that opens a window instead of scrolling */
  .nav__cfg {
    display: block;
    width: 100%;
    padding: 3px 6px;
    text-align: left;
    font-size: 12.5px;
    color: var(--ink-dim);
    background: none;
    border: 0;
    border-left: 2px solid transparent;
  }
  .nav__cfg::before {
    content: "» ";
    color: var(--leaf);
  }
  .nav__cfg:hover {
    color: var(--lime);
    background: color-mix(in srgb, var(--lime) 6%, transparent);
    border-left-color: var(--lime);
  }

  .now {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 5px;
    font-size: 11.5px;
  }
  .now li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .now span {
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 10px;
  }
  .now b {
    color: var(--ink-dim);
    font-weight: 400;
    text-align: right;
  }
</style>
