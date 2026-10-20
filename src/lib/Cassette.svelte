<script>
  import { onMount } from "svelte";
  import { config } from "./config.svelte.js";
  import { unlock } from "./achievements.svelte.js";
  import { parseLink, embedUrl, describeLink, frameHeight } from "./music.js";

  // A cassette deck pinned to the bottom-left corner. It plays one
  // thing, and it is the visitor's: a youtube link they paste. Nothing
  // loads until they ask — the iframe is only put in the page when they
  // press play, so a visitor who never touches the deck pulls zero
  // third-party bytes.
  //
  // The transport keys stand on top of the deck (play, stop, change,
  // forget); the shell holds the screen; the reels turn while it plays.

  // `loaded` is whether the iframe is in the page at all; `editing` is
  // whether the paste field is open. Both are separate from the link
  // itself, which lives in the config.
  let loaded = $state(false);
  let editing = $state(false);
  let reduced = $state(false);
  let draft = $state("");
  let note = $state("");
  let deckEl;
  let keysEl;
  let screenW = $state(0);

  const link = $derived(
    config.music && config.music.platform ? config.music : null,
  );
  const hasLink = $derived(!!link);
  const what = $derived(link ? describeLink(link) : "");
  const src = $derived.by(() => {
    if (!link) return "";
    const base = embedUrl(link);
    if (!base) return "";
    // youtube can start on its own once the visitor has asked for it
    return base + (base.includes("?") ? "&" : "?") + "autoplay=1";
  });
  const frameH = $derived(link ? frameHeight(link, screenW) : 0);
  const stateText = $derived(
    !hasLink ? "no tape" : loaded ? "playing" : "ready",
  );

  onMount(() => {
    // publish the deck's height so the trophy toasts can stack above it
    // instead of behind it — the two share the bottom-left corner. the
    // keys stand on top of the deck, so they count towards that height.
    const publish = () => {
      if (!deckEl) return;
      const h = deckEl.offsetHeight + (keysEl?.offsetHeight ?? 0);
      document.documentElement.style.setProperty("--deck-h", `${h}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(deckEl);
    if (keysEl) ro.observe(keysEl);

    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--deck-h");
    };
  });

  function play() {
    if (!hasLink) {
      editing = true;
      return;
    }
    loaded = true;
    editing = false;
    note = "";
    unlock("music");
  }

  function stop() {
    loaded = false;
  }

  // fold the deck down to its head bar. the frame stays in the page —
  // we only clip it — so the music keeps playing while it is tucked away.
  function toggleReduce() {
    reduced = !reduced;
  }

  function change() {
    // changing the link means stopping what is playing, so the paste
    // field can take over the screen
    loaded = false;
    editing = true;
    draft = "";
    note = "";
  }

  function forget() {
    config.music = { platform: "", kind: "", id: "" };
    loaded = false;
    editing = false;
    draft = "";
    note = "";
  }

  function connect() {
    const parsed = parseLink(draft);
    if (!parsed) {
      note = "that is not a youtube link.";
      return;
    }
    config.music = parsed;
    draft = "";
    editing = false;
    note = "";
    loaded = true;
  }
</script>

<div class="decklayer">
  <div class="deck" class:playing={loaded} class:reduced bind:this={deckEl}>
    <div
      class="deck__keys"
      role="group"
      aria-label="deck controls"
      bind:this={keysEl}
    >
      <button
        class="key"
        class:down={loaded}
        onclick={play}
        aria-label="play"
        title="play"
      >
        <span class="key__cap" aria-hidden="true">▶</span>
      </button>
      <button
        class="key"
        onclick={stop}
        disabled={!loaded}
        aria-label="stop"
        title="stop"
      >
        <span class="key__cap" aria-hidden="true">■</span>
      </button>
      <button
        class="key"
        onclick={change}
        aria-label="change the link"
        title="change the link"
      >
        <span class="key__cap" aria-hidden="true">✎</span>
      </button>
      <button
        class="key"
        onclick={forget}
        disabled={!hasLink}
        aria-label="forget the link"
        title="forget the link"
      >
        <span class="key__cap" aria-hidden="true">✕</span>
      </button>
    </div>

    <div class="deck__labels" aria-hidden="true">
      <span class="key__label" class:down={loaded}>play</span>
      <span class="key__label">stop</span>
      <span class="key__label">change</span>
      <span class="key__label">forget</span>
    </div>

    <div class="deck__head">
      <span class="deck__tag">♪ your music</span>
      <span class="reels" aria-hidden="true">
        <span class="reel reel--l"></span>
        <span class="reel reel--r"></span>
      </span>
      <span class="deck__led" aria-hidden="true"></span>
      <button
        class="deck__fold"
        onclick={toggleReduce}
        aria-label={reduced ? "expand the deck" : "reduce the deck"}
        title={reduced ? "expand the deck" : "reduce the deck"}
      >
        <span aria-hidden="true">{reduced ? "▴" : "▾"}</span>
      </button>
    </div>

    <div class="shell" class:playing={loaded}>
      <div class="screen" bind:clientWidth={screenW}>
        {#if loaded && src}
          <iframe
            class="screen__frame"
            {src}
            title={what}
            style="height:{frameH}px"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        {:else if editing || !hasLink}
          <div class="setup">
            <p class="setup__blurb">
              nothing is loaded. paste a youtube link — this is yours, and it
              only plays when you say so.
            </p>
            <div class="setup__row">
              <input
                class="setup__input"
                type="url"
                bind:value={draft}
                placeholder="paste a link…"
                aria-label="music link"
                onkeydown={(e) => e.key === "Enter" && connect()}
              />
              <button class="setup__go" onclick={connect}>connect</button>
            </div>
            {#if note}<p class="setup__note">{note}</p>{/if}
            <p class="setup__fine">
              playing from a platform means that platform sees you. that is your
              choice.
            </p>
          </div>
        {:else}
          <div class="ready">
            <span class="ready__what">{what}</span>
            <span class="ready__hint">press ▶ to load it</span>
          </div>
        {/if}
      </div>

      <div class="shell__label">
        <span class="shell__name">{hasLink ? what : "no tape"}</span>
        <span class="shell__state">{stateText}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .decklayer {
    position: fixed;
    inset: 0;
    z-index: 55;
    pointer-events: none;
  }

  /* docked to the bottom edge, so it reads as a deck sitting on a shelf */
  .deck {
    position: absolute;
    left: 14px;
    bottom: 0;
    width: 340px;
    padding: 6px 10px 10px;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line-hot);
    border-bottom: 0;
    border-radius: 5px 5px 0 0;
    box-shadow:
      0 -16px 36px -24px #000,
      inset 1px 1px 0 rgba(255, 255, 255, 0.05);
    pointer-events: auto;
  }

  .deck__head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
  }
  .deck__tag {
    flex: 1 1 auto;
    min-width: 0;
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    text-shadow: 0 0 6px color-mix(in srgb, var(--gold) 50%, transparent);
  }
  .deck__led {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--line-hot);
    transition:
      background 0.2s ease,
      box-shadow 0.2s ease;
  }
  .deck.playing .deck__led {
    background: var(--lime);
    box-shadow: var(--glow-lime);
    animation: pulse 1.8s ease-in-out infinite;
  }

  /* the fold key: tucks the deck down to this bar, music still playing */
  .deck__fold {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    font: inherit;
    font-size: 10px;
    line-height: 1;
    color: var(--ink-faint);
    background: none;
    border: 1px solid var(--line-hot);
    border-radius: 2px;
    cursor: pointer;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }
  .deck__fold:hover {
    color: var(--ink);
    border-color: var(--gold);
  }
  .deck__fold:focus-visible {
    outline: none;
    border-color: var(--lime);
  }

  /* --- the reels, small, in the head --- */
  .reels {
    flex: 0 0 auto;
    display: flex;
    gap: 5px;
  }
  .reel {
    position: relative;
    width: 16px;
    height: 16px;
    border: 1.5px solid var(--line-hot);
    border-radius: 50%;
    background: repeating-conic-gradient(
      from 0deg,
      var(--line-hot) 0deg 14deg,
      transparent 14deg 60deg
    );
    animation: reel-spin 2.6s linear infinite;
    animation-play-state: paused;
  }
  .reel--r {
    animation-direction: reverse;
  }
  .reel::after {
    content: "";
    position: absolute;
    inset: 40%;
    border-radius: 50%;
    background: var(--line-hot);
  }
  .deck.playing .reel {
    animation-play-state: running;
  }
  @keyframes reel-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* --- the row of transport keys --- */
  /* The keys stand on top of the deck, seen from the front: each one is
     a small block with a lighter top face. Their names are printed
     inside the deck, just under the top edge. Pressing a key sinks it —
     play stays sunk while it is loaded, the rest spring back. */
  .deck__keys {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 100%;
    display: flex;
    gap: 4px;
    /* clip the keys at the deck's top edge, so a pressed key slides
       down behind the case instead of sitting on top of it */
    overflow: hidden;
  }

  .key {
    flex: 1 1 0;
    min-width: 0;
    padding: 0;
    font: inherit;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .key:disabled {
    cursor: default;
  }

  .key__cap {
    display: grid;
    place-items: center;
    width: 100%;
    height: 20px;
    font-size: 13px;
    line-height: 1;
    color: var(--ink-faint);
    /* the lighter strip along the top reads as the key's top face */
    background: linear-gradient(180deg, #3a3350 0 4px, #241d33 4px 100%);
    border: 1px solid var(--line-hot);
    border-radius: 2px;
    transform: translateY(0);
    transition:
      transform 0.09s cubic-bezier(0.3, 0.7, 0.4, 1),
      color 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }
  .key:hover:not(:disabled) .key__cap {
    color: var(--ink);
    background: linear-gradient(180deg, #443c5e 0 4px, #2b2340 4px 100%);
  }
  .key:focus-visible {
    outline: none;
  }
  .key:focus-visible .key__cap {
    border-color: var(--lime);
  }
  .key:disabled .key__cap {
    opacity: 0.4;
  }

  /* pressed: the key sinks */
  .key:active:not(:disabled) .key__cap,
  .key.down .key__cap {
    transform: translateY(4px);
    color: var(--ink);
    border-color: color-mix(in srgb, var(--gold) 55%, transparent);
    background: linear-gradient(180deg, #2e2740 0 4px, #1a1428 4px 100%);
  }
  .key.down .key__cap {
    color: var(--lime);
    border-color: color-mix(in srgb, var(--lime) 55%, transparent);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--lime) 26%, #241d33) 0 4px,
      color-mix(in srgb, var(--lime) 16%, #1a1428) 4px 100%
    );
  }

  /* the names, printed inside the deck under the top edge */
  .deck__labels {
    display: flex;
    gap: 4px;
    margin-bottom: 7px;
  }
  .key__label {
    flex: 1 1 0;
    min-width: 0;
    text-align: center;
    font-size: 8.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .key__label.down {
    color: var(--lime);
    text-shadow: 0 0 6px color-mix(in srgb, var(--lime) 55%, transparent);
  }

  /* --- the shell --- */
  .shell {
    margin-top: 8px;
    padding: 8px;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line-hot);
    border-radius: 4px;
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.05),
      inset -1px -1px 0 rgba(0, 0, 0, 0.5);
  }

  /* the screen: the embed lives here, or the setup, or the ready card */
  .screen {
    position: relative;
    min-height: 96px;
    background: linear-gradient(180deg, var(--bg-2), var(--bg));
    border: 1px solid var(--line);
    border-radius: 3px;
    box-shadow: inset 0 0 22px -8px #000;
    overflow: hidden;
  }
  .screen__frame {
    display: block;
    width: 100%;
    border: 0;
  }

  /* --- the setup: paste a link --- */
  .setup {
    padding: 10px;
  }
  .setup__blurb {
    margin: 0 0 8px;
    font-size: 10.5px;
    line-height: 1.5;
    color: var(--ink-dim);
  }
  .setup__row {
    display: flex;
    gap: 6px;
  }
  .setup__input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 5px 7px;
    font: inherit;
    font-size: 11px;
    color: var(--ink);
    background: var(--well);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
  }
  .setup__input::placeholder {
    color: var(--ink-faint);
  }
  .setup__input:focus-visible {
    outline: none;
    border-color: var(--lime);
  }
  .setup__go {
    flex: 0 0 auto;
    padding: 5px 10px;
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--on-accent);
    background: var(--lime);
    border: 0;
    border-radius: 3px;
    cursor: pointer;
  }
  .setup__note {
    margin: 7px 0 0;
    font-size: 10.5px;
    color: var(--orange);
  }
  .setup__fine {
    margin: 8px 0 0;
    font-size: 9.5px;
    line-height: 1.5;
    color: var(--ink-faint);
  }

  /* --- the ready card: a link is set, not loaded --- */
  .ready {
    display: grid;
    place-items: center;
    gap: 5px;
    min-height: 96px;
    padding: 10px;
    text-align: center;
  }
  .ready__what {
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.04em;
    color: var(--ink);
  }
  .ready__hint {
    font-size: 9.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  .shell__label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-top: 7px;
    padding: 5px 9px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--gold) 14%, var(--panel-2)),
      var(--panel)
    );
    border: 1px solid var(--line-hot);
    border-radius: 3px;
  }
  .shell__name {
    min-width: 0;
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.05em;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .shell__state {
    flex: 0 0 auto;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .shell.playing .shell__state {
    color: var(--lime);
  }

  /* --- reduced: the deck folds down to its head bar --- */
  /* The frame stays in the page so the music keeps playing. We clip the
     shell rather than display:none it: a hidden iframe reports itself as
     hidden and youtube pauses, but a clipped one plays on. */
  .deck.reduced {
    padding-bottom: 6px;
  }
  .deck.reduced .deck__keys,
  .deck.reduced .deck__labels {
    display: none;
  }
  .deck.reduced .deck__head {
    margin-bottom: 0;
  }
  .deck.reduced .shell {
    height: 0;
    margin-top: 0;
    padding: 0;
    border-width: 0;
    overflow: hidden;
  }

  @media (max-width: 620px) {
    .deck {
      left: 10px;
      width: min(340px, calc(100vw - 20px));
    }
  }
</style>
