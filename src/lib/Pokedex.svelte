<script>
  // pokedex.dat — every pokémon you have met, as a grid.
  //
  // The dex is a set of dex numbers, kept in the encounter's signed
  // storage (see encounter-store.js) and shared through the reactive
  // store in encounter.svelte.js, so a roll in wild_encounter.dat shows
  // up here without a reload.
  //
  // It is a modal, opened from the wild encounter rather than a section
  // of its own: the dex only means anything next to the grass you roll
  // in. It follows the settings.cfg dialog pattern — a veil, a trap for
  // Tab, Escape to close, and the page behind held still.
  //
  // Nothing is fetched to draw the grid: a sprite is derived from its
  // dex number, and an unseen entry is a plain `?` — so the number of
  // image requests equals how many you have actually met, not 1025.
  // The one request is the list of names, shared with the encounter
  // window and only used for the tooltips.

  import { onMount } from "svelte";
  import { encounter, encounterReady, hydrate } from "./encounter.svelte.js";
  import { loadPool, spriteUrl, idOf, GEN_RANGES, DEX_MAX } from "./pokeapi.js";
  import { lockScroll, unlockScroll } from "./scroll-lock.js";
  import { trapFocus } from "./focus-trap.js";

  let { onClose } = $props();

  hydrate();

  const VIEWS = [
    { id: "all", label: "all" },
    { id: "seen", label: "seen" },
    { id: "caught", label: "caught" },
    { id: "shiny", label: "shiny" },
  ];

  let gen = $state("all"); // "all" | 1..9
  let view = $state("all"); // all | seen | caught | shiny
  let names = $state(null); // Map<id, name>, for the tooltips only
  let broken = $state({});

  onMount(() => {
    // the names are cosmetic, so a failed fetch just means no tooltips
    loadPool()
      .then((pool) => {
        const map = new Map();
        for (const p of pool) map.set(idOf(p), p.name.replace(/-/g, " "));
        names = map;
      })
      .catch(() => {});

    lockScroll();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  });

  // the ids to show, in dex order. the generation narrows the range; the
  // view narrows it further to what you have seen, caught or seen shiny.
  const ids = $derived.by(() => {
    const range = gen === "all" ? null : GEN_RANGES.find((g) => g.gen === gen);
    const from = range ? range.from : 1;
    const to = range ? range.to : DEX_MAX;
    const out = [];
    for (let id = from; id <= to; id++) {
      if (view === "seen" && !encounter.seen.has(id)) continue;
      if (view === "caught" && !encounter.caught.has(id)) continue;
      if (view === "shiny" && !encounter.shiny.has(id)) continue;
      out.push(id);
    }
    return out;
  });

  const seenCount = $derived(encounter.seen.size);
  const caughtCount = $derived(encounter.caught.size);
  const shinyCount = $derived(encounter.shiny.size);
  const pct = $derived(Math.round((seenCount / DEX_MAX) * 100));

  const name = (id) => names?.get(id) ?? `#${id}`;
  const pad = (id) => String(id).padStart(4, "0");
</script>

<div
  class="veil"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div
    class="dlg"
    role="dialog"
    aria-modal="true"
    aria-label="pokedex"
    tabindex="-1"
    use:trapFocus
  >
    <div class="panel__bar">
      <span class="panel__title">pokedex.dat</span>
      <span class="dlg__spacer"></span>
      <span class="dlg__tag">{seenCount} / {DEX_MAX}</span>
      <button class="dlg__x" onclick={onClose} aria-label="close the pokedex"
        >✕</button
      >
    </div>

    <div class="dlg__body dex">
      <div class="dex__stats">
        <p class="dex__count">
          <b>{seenCount}</b> / {DEX_MAX} met
        </p>
        <div class="dex__bar" aria-hidden="true">
          <span style="width:{pct}%"></span>
        </div>
        <p class="dex__sub">
          <span class="dex__tag dex__tag--caught">{caughtCount} caught</span>
          <span class="dex__tag dex__tag--shiny">{shinyCount} shiny</span>
        </p>
      </div>

      <div class="dex__filters">
        <div class="dex__group" role="group" aria-label="generation">
          <span class="dex__label">gen</span>
          <button
            class="chip"
            class:on={gen === "all"}
            onclick={() => (gen = "all")}
            aria-pressed={gen === "all"}>all</button
          >
          {#each GEN_RANGES as g}
            <button
              class="chip"
              class:on={gen === g.gen}
              onclick={() => (gen = g.gen)}
              aria-pressed={gen === g.gen}>{g.gen}</button
            >
          {/each}
        </div>

        <div class="dex__group" role="group" aria-label="show">
          <span class="dex__label">show</span>
          {#each VIEWS as v}
            <button
              class="chip"
              class:on={view === v.id}
              onclick={() => (view = v.id)}
              aria-pressed={view === v.id}>{v.label}</button
            >
          {/each}
        </div>
      </div>

      {#if !encounterReady.value}
        <p class="dex__wait">reading the dex<span class="cursor"></span></p>
      {:else if ids.length === 0}
        <p class="dex__wait">
          {view === "all"
            ? "nothing in this generation yet."
            : `nothing ${view} here yet — go and meet one.`}
        </p>
      {:else}
        <ul class="dex__grid">
          {#each ids as id (id)}
            {@const isSeen = encounter.seen.has(id)}
            {@const isCaught = encounter.caught.has(id)}
            {@const isShiny = encounter.shiny.has(id)}
            <li
              class="cell"
              class:seen={isSeen}
              class:caught={isCaught}
              class:shiny={isShiny}
              title={isSeen ? `${pad(id)} ${name(id)}` : `${pad(id)} — not met`}
            >
              {#if isSeen}
                {#if broken[id]}
                  <span class="cell__q" aria-hidden="true">◓</span>
                {:else}
                  <img
                    src={spriteUrl(id, isShiny)}
                    alt={name(id)}
                    width="48"
                    height="48"
                    loading="lazy"
                    onerror={() => (broken[id] = true)}
                  />
                {/if}
              {:else}
                <span class="cell__q" aria-hidden="true">?</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <p class="dex__note">
        one encounter a day, so this fills slowly. a <b>?</b> is a pokémon you have
        not met; a green corner is one you kept, a gold glow is a shiny. nothing here
        is fetched to draw it — only the names, once, when you open the page.
      </p>
    </div>
  </div>
</div>

<style>
  /* the dialog follows settings.cfg — same veil, same pop, so the two
     modals feel like the same piece of the page */
  .veil {
    position: fixed;
    inset: 0;
    z-index: 280;
    display: grid;
    place-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    backdrop-filter: blur(4px);
    animation: fade 0.18s ease;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  .dlg {
    display: flex;
    flex-direction: column;
    width: min(680px, 100%);
    max-height: 92vh;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
    box-shadow:
      0 0 0 1px #000,
      0 0 60px -14px color-mix(in srgb, var(--leaf) 40%, transparent),
      0 30px 60px -30px #000;
    animation: pop 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.15);
    overflow: hidden;
  }
  @keyframes pop {
    from {
      transform: scale(0.97) translateY(8px);
      opacity: 0;
    }
  }

  .dlg__spacer {
    flex: 1;
  }
  .dlg__tag {
    font-family: var(--pixel);
    font-size: 16px;
    color: var(--leaf);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
    padding: 0 7px;
  }
  .dlg__x {
    width: 24px;
    height: 22px;
    display: grid;
    place-items: center;
    font-size: 11px;
    color: var(--orange);
    background: color-mix(in srgb, var(--orange) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--orange) 50%, transparent);
    border-radius: 3px;
  }
  .dlg__x:hover {
    background: color-mix(in srgb, var(--orange) 30%, transparent);
  }

  .dlg__body {
    overflow-y: auto;
    padding: 16px 18px 18px;
    scrollbar-width: thin;
  }

  .dex {
    display: grid;
    gap: 12px;
  }

  .dex__stats {
    display: grid;
    gap: 6px;
  }
  .dex__count {
    margin: 0;
    font-family: var(--pixel);
    font-size: 20px;
    letter-spacing: 0.05em;
    color: var(--ink-dim);
  }
  .dex__count b {
    font-size: 26px;
    font-weight: 400;
    color: var(--lime);
    text-shadow: var(--glow-lime);
  }
  .dex__bar {
    height: 6px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    overflow: hidden;
  }
  .dex__bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--leaf), var(--lime));
    box-shadow: 0 0 12px -2px var(--lime);
    transition: width 0.4s ease;
  }
  .dex__sub {
    margin: 0;
    display: flex;
    gap: 8px;
  }
  .dex__tag {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--ink-faint);
  }
  .dex__tag--caught {
    color: var(--lime);
    border-color: color-mix(in srgb, var(--lime) 45%, transparent);
    background: color-mix(in srgb, var(--lime) 10%, transparent);
  }
  .dex__tag--shiny {
    color: var(--gold);
    border-color: color-mix(in srgb, var(--gold) 45%, transparent);
    background: color-mix(in srgb, var(--gold) 10%, transparent);
  }

  .dex__filters {
    display: grid;
    gap: 6px;
  }
  .dex__group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .dex__label {
    margin-right: 2px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .chip {
    min-width: 24px;
    padding: 3px 8px;
    font-family: var(--mono);
    font-size: 10.5px;
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
  .chip:hover {
    color: var(--ink);
    border-color: var(--line-hot);
  }
  .chip.on {
    color: var(--violet);
    background: color-mix(in srgb, var(--violet) 12%, transparent);
    border-color: color-mix(in srgb, var(--violet) 50%, transparent);
    box-shadow: 0 0 14px -4px color-mix(in srgb, var(--violet) 70%, transparent);
  }

  .dex__grid {
    list-style: none;
    margin: 0;
    padding: 0 4px 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
    gap: 3px;
    max-height: min(56vh, 520px);
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .cell {
    position: relative;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.02);
  }
  .cell img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .cell__q {
    font-family: var(--pixel);
    font-size: 15px;
    color: var(--ink-faint);
    opacity: 0.6;
  }
  .cell.seen {
    border-color: var(--line-hot);
    background: rgba(255, 255, 255, 0.05);
  }
  .cell.caught {
    border-color: color-mix(in srgb, var(--lime) 55%, transparent);
  }
  .cell.caught::after {
    content: "";
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--lime);
    box-shadow: 0 0 6px var(--lime);
  }
  .cell.shiny {
    border-color: color-mix(in srgb, var(--gold) 60%, transparent);
    box-shadow: 0 0 10px -3px var(--gold);
  }

  .dex__wait {
    margin: 0;
    padding: 14px 0;
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
  }
  .dex__note {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.6;
    color: var(--ink-faint);
  }
  .dex__note b {
    color: var(--ink-dim);
    font-weight: 400;
  }
</style>
