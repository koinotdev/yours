<script>
  import { openSecret, openSynth } from "./secret.js";
  import { config } from "./config.svelte.js";
  import { tod } from "./timeofday.svelte.js";
  import { unlock } from "./achievements.svelte.js";
  import PageWeight from "./PageWeight.svelte";

  let taps = 0;
  function pokeLeaf() {
    taps++;
    if (taps >= 3) {
      taps = 0;
      unlock("leaf-picker");
      openSecret();
    }
  }
</script>

<footer class="foot">
  <div class="wrap foot__in">
    <div class="foot__col">
      <p class="foot__brand">
        {config.identity.title}<span class="foot__slash">://</span>home
      </p>
      <p class="foot__note">
        hand-built with svelte &amp; css. no frameworks were harmed. no cookies,
        no analytics, no pop-ups asking you to subscribe.
      </p>
    </div>

    <div class="foot__col">
      <p class="foot__label">colophon</p>
      <ul class="foot__list">
        <li>type — space grotesk / jetbrains mono / vt323</li>
        <li>palette — lime, leaf, cyan, gold, magenta</li>
        <li>light — {config.lighting ? tod.phase : "steady"}</li>
        <li>energy — 100% renewable daydreams</li>
      </ul>
    </div>

    <div class="foot__col">
      <p class="foot__label">best viewed</p>
      <p class="foot__note">
        in any browser, at any size, with the lights low. this page is always
        under construction.
      </p>
      <p class="foot__hint">
        psst — some things are hidden.
        <button class="leaf" onclick={pokeLeaf} aria-label="a small leaf"
          >❧</button
        >
        <button
          class="note"
          onclick={openSynth}
          aria-label="a small note"
          title="synth.exe">♪</button
        >
      </p>
      <PageWeight />
    </div>
  </div>

  <div class="foot__base">
    <div class="wrap foot__base-in">
      <span>© 1996—2026 {config.identity.title}. all rights reserved-ish.</span>
      <span class="foot__blink"
        >made on planet earth <span class="cursor"></span></span
      >
    </div>
  </div>
</footer>

<style>
  .foot {
    position: relative;
    z-index: 1;
    margin-top: 26px;
    border-top: 1px solid var(--line);
    background: linear-gradient(
      180deg,
      transparent,
      color-mix(in srgb, var(--leaf) 4%, transparent)
    );
  }

  .foot__in {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
    gap: 24px;
    padding-block: 30px;
  }

  .foot__brand {
    margin: 0 0 8px;
    font-family: var(--display);
    font-weight: 700;
    font-size: 19px;
    letter-spacing: -0.01em;
  }
  .foot__slash {
    color: var(--lime);
  }

  .foot__note {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.65;
    color: var(--ink-dim);
    max-width: 42ch;
  }

  .foot__label {
    margin: 0 0 8px;
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    text-shadow: var(--glow-gold);
  }

  .foot__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 5px;
    font-size: 11px;
    color: var(--ink-faint);
  }
  .foot__list li::before {
    content: "› ";
    color: var(--leaf);
  }

  .foot__hint {
    margin: 12px 0 0;
    font-size: 11px;
    color: var(--ink-faint);
  }
  .leaf {
    padding: 0 2px;
    font-size: 15px;
    color: var(--leaf);
    background: none;
    border: 0;
    transition:
      transform 0.2s ease,
      text-shadow 0.2s ease;
  }
  .leaf:hover {
    transform: scale(1.3) rotate(-12deg);
    text-shadow: var(--glow-lime);
  }
  .note {
    padding: 0 2px;
    font-size: 15px;
    color: var(--gold);
    background: none;
    border: 0;
    transition:
      transform 0.2s ease,
      text-shadow 0.2s ease;
  }
  .note:hover {
    transform: scale(1.3) rotate(12deg);
    text-shadow: var(--glow-gold);
  }

  .foot__base {
    border-top: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.25);
  }
  .foot__base-in {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    padding-block: 12px;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .foot__blink {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  @media (max-width: 760px) {
    .foot__in {
      grid-template-columns: 1fr;
      gap: 22px;
    }
  }
</style>
