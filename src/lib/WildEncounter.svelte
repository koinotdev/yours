<script>
  // A wild encounter, rolled from PokéAPI. Nothing is fetched until you
  // click: the list endpoint is tiny (~50 kB of names), and the sprite URL
  // is built from the id in the entry rather than fetched from the detail
  // endpoint (which is ~50 kB per Pokémon — never worth it).
  //
  // One encounter a day, and a 1-in-4096 chance it is shiny. What you meet
  // can be kept in a party of six. Like the notebook, the party is yours and
  // lives under its own localStorage key — it is not part of the config, so
  // exporting your "home" never carries your pokémon out with it.
  //
  // The storage is hard to hand-edit — see encounter-store.js.

  import { onMount } from "svelte";
  import {
    encounter,
    encounterReady,
    hydrate,
    persist,
    recordSeen,
    recordCaught,
    recordGuess,
    revealToday,
    dayKey,
    derive,
    newSeed,
    PARTY_MAX,
    SHINY_ODDS,
  } from "./encounter.svelte.js";
  import { loadPool, spriteUrl, spriteKey, DEX_MAX } from "./pokeapi.js";
  import { unlock } from "./achievements.svelte.js";
  import { isGuest } from "./share.svelte.js";
  import { windowState } from "./windows.svelte.js";
  import WinBtns from "./WinBtns.svelte";

  let { onOpenDex } = $props();

  const SPECIES = (id) => `https://pokeapi.co/api/v2/pokemon-species/${id}`;
  const SLOTS = Array.from({ length: PARTY_MAX }, (_, i) => i);

  // the day can roll over while the tab stays open, so this is reactive and
  // refreshed on focus / visibility change rather than frozen at load
  let today = $state(dayKey());

  let phase = $state("idle"); // idle | loading | error
  let spriteOk = $state(true);
  // per-sprite fallback for the party slots, keyed by `${id}:${shiny}` — a
  // broken image in one slot must not blank out the others
  let broken = $state({});
  let replacing = $state(false);
  let partyOpen = $state(true);
  let editing = $state(null); // the slot whose name is being typed, or null
  let draft = $state("");

  // the silhouette game. `revealed` is shared (and persisted) so a
  // reload before you guess still hides the name; `verdict` is only
  // for this visit, so it is not stored.
  let guess = $state("");
  let verdict = $state(null); // null | "right" | "wrong"

  // the shared store loads once for the whole page — the pokédex reads the
  // same object, so a roll here shows up there without a reload
  hydrate();

  const mon = $derived(encounter.today);
  const metToday = $derived(encounter.day === today && !!encounter.today);
  const inParty = $derived(
    !!mon &&
      encounter.party.some((p) => p.id === mon.id && p.shiny === mon.shiny),
  );
  const dex = $derived(mon ? String(mon.id).padStart(4, "0") : "----");
  const label = $derived(mon ? mon.name.replace(/-/g, " ") : "");
  const revealed = $derived(encounter.revealed);
  const guessRun = $derived(encounter.guessRun);
  const guessBest = $derived(encounter.guessBest);
  const seenCount = $derived(encounter.seen.size);
  // a guest is only looking: the party belongs to the room being visited, so
  // it is shown but never edited. writes are dropped anyway (share.svelte.js),
  // but the controls should not pretend otherwise.
  const guest = $derived(isGuest());

  // the species name as pokéapi spells it, and what the slot actually shows
  const species = (p) => p.name.replace(/-/g, " ");
  const display = (p) => p.nickname || species(p);

  // legendary / mythical / baby are flags on the species endpoint, not on
  // the list. one extra request, only on a roll, and only to light a trophy —
  // the reveal never waits on it, so a slow or offline api just means no
  // trophy, never a broken encounter.
  async function rarity(id) {
    try {
      const res = await fetch(SPECIES(id));
      if (!res.ok) return;
      const s = await res.json();
      if (s.is_legendary) unlock("legendary");
      if (s.is_mythical) unlock("mythical");
      if (s.is_baby) unlock("baby");
    } catch {
      /* offline, or the api is down — the encounter still stands */
    }
  }

  async function roll() {
    if (!encounterReady.value || metToday) return;
    phase = "loading";
    spriteOk = true;
    try {
      // the list is cached for the whole page, so the pokédex opening
      // first does not cost a second request
      const pool = await loadPool();
      // the seed decides the encounter; the pool only supplies the name
      const seed = newSeed();
      const { id, shiny } = derive(seed);
      const entry = pool.find(
        (p) => Number(p.url.split("/").filter(Boolean).pop()) === id,
      );
      encounter.seed = seed;
      encounter.today = { id, shiny, name: entry ? entry.name : `#${id}` };
      encounter.day = today;
      encounter.revealed = false;
      guess = "";
      verdict = null;
      recordSeen(id, shiny);
      await persist();
      unlock("wild-one");
      if (shiny) unlock("shiny");
      phase = "idle";
      // fire-and-forget: the rarity trophy lands a beat after the reveal
      rarity(id);
    } catch {
      phase = "error";
    }
  }

  async function addToParty() {
    if (!mon || inParty) return;
    if (encounter.party.length < PARTY_MAX) {
      encounter.party.push({ ...mon });
      recordCaught(mon.id);
      await persist();
      if (encounter.party.length >= PARTY_MAX) unlock("full-party");
      partyOpen = true;
      return;
    }
    // full — ask which one to let go
    replacing = true;
    partyOpen = true;
  }

  async function replaceAt(i) {
    if (!mon) return;
    encounter.party[i] = { ...mon };
    recordCaught(mon.id);
    replacing = false;
    await persist();
    unlock("full-party");
  }

  onMount(() => {
    const sync = () => {
      today = dayKey();
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  });

  // renaming is cosmetic — the dex number and the shiny flag are re-derived
  // from the seed, so a nickname can never change what a mon actually is
  function startEdit(i, p) {
    editing = i;
    draft = p.nickname || species(p);
  }

  async function commitEdit(i) {
    if (editing !== i) return;
    editing = null;
    const p = encounter.party[i];
    if (!p) return;
    const v = draft.trim().slice(0, 40);
    // clearing the field, or typing the species name back, drops the nickname
    const next = v && v !== species(p) ? v : "";
    if ((p.nickname || "") === next) return;
    encounter.party[i] = { ...p, nickname: next };
    await persist();
    // only a name actually given counts — clearing one back to the species
    // name is not a naming
    if (next) unlock("nicknamer");
  }

  // focus and select the whole name, so typing replaces it
  function autoselect(node) {
    node.focus();
    node.select();
  }

  /* ---------- the silhouette game ---------- */

  // names are compared loosely: case, spaces, hyphens, apostrophes and
  // accents are all dropped, so "mr. mime", "Mr-Mime" and "mrmime" all
  // count. it is a friendly game, not a spelling bee.
  const norm = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  function submitGuess(e) {
    e?.preventDefault();
    if (!mon || revealed || !guess.trim()) return;
    const ok = norm(guess) === norm(mon.name);
    verdict = ok ? "right" : "wrong";
    recordGuess(ok);
    persist();
    unlock("guess-first");
    if (ok) {
      unlock("guess-right");
      if (encounter.guessRun >= 5) unlock("guess-streak-5");
      if (encounter.guessRun >= 10) unlock("guess-streak-10");
    }
  }

  function skipGuess() {
    if (!mon || revealed) return;
    verdict = null;
    revealToday();
    persist();
  }
</script>

{#snippet face(p)}
  {#if broken[spriteKey(p)]}
    <span class="slot__fallback" aria-hidden="true">◓</span>
  {:else}
    <img
      class="slot__sprite"
      src={spriteUrl(p.id, p.shiny)}
      alt=""
      width="48"
      height="48"
      loading="lazy"
      onerror={() => (broken[spriteKey(p)] = true)}
    />
  {/if}
  {#if p.shiny}<span class="slot__shiny" title="shiny">✨</span>{/if}
{/snippet}

<section
  class="panel"
  id="encounter"
  class:min={windowState("encounter") === "min"}
>
  <div class="panel__bar">
    <span class="panel__title">wild_encounter.dat</span>
    <WinBtns id="encounter" />
  </div>

  <div class="panel__body enc">
    <div
      class="enc__screen"
      class:is-shiny={mon?.shiny && phase === "idle" && revealed}
    >
      <div class="enc__grass" aria-hidden="true"></div>

      {#if phase === "loading"}
        <span class="enc__wait"
          >searching the tall grass<span class="cursor"></span></span
        >
      {:else if phase === "error"}
        <span class="enc__wait enc__wait--err"
          >the grass is empty — try again</span
        >
      {:else if mon}
        {#if spriteOk}
          <img
            class="enc__sprite"
            class:enc__sprite--mystery={!revealed}
            src={spriteUrl(mon.id, mon.shiny)}
            alt={revealed ? label : "a mystery pokemon"}
            width="96"
            height="96"
            onerror={() => (spriteOk = false)}
          />
        {:else}
          <span class="enc__fallback" aria-hidden="true">◓</span>
        {/if}
      {:else}
        <span class="enc__wait">tall grass, rustling…</span>
      {/if}

      <div class="enc__crt" aria-hidden="true"></div>
    </div>

    <div class="enc__readout">
      <p class="enc__dex">#{revealed ? dex : "????"}</p>
      <p class="enc__name">
        {revealed ? label || "—" : "who's that pokémon?"}
      </p>
      {#if mon?.shiny && phase === "idle" && revealed}
        <span class="enc__shiny">✨ shiny</span>
      {/if}
    </div>

    <div class="enc__actions">
      {#if mon && phase === "idle" && !revealed}
        <form class="enc__guess" onsubmit={submitGuess}>
          <input
            class="enc__guess-input"
            bind:value={guess}
            maxlength="40"
            placeholder="guess the name…"
            aria-label="guess the pokemon's name"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <button class="btn" type="submit" disabled={!guess.trim()}
            >guess</button
          >
          <button class="btn btn--ghost" type="button" onclick={skipGuess}
            >reveal</button
          >
        </form>
      {:else if metToday}
        <button class="btn" disabled>✓ met today's pokemon</button>
      {:else}
        <button
          class="btn"
          onclick={roll}
          disabled={!encounterReady.value || phase === "loading"}
        >
          {phase === "loading" ? "searching…" : "▶ roll a wild encounter"}
        </button>
      {/if}

      {#if verdict}
        <p class="enc__verdict" class:ok={verdict === "right"}>
          {#if verdict === "right"}
            ✓ right — it was <b>{label}</b>
          {:else}
            ✕ not quite — it was <b>{label}</b>
          {/if}
        </p>
      {/if}

      {#if mon && phase === "idle" && revealed}
        {#if inParty}
          <span class="enc__kept">in your party ✓</span>
        {:else if !guest}
          <button class="btn btn--gold" onclick={addToParty}>+ keep it</button>
        {/if}
      {/if}

      {#if guessRun > 0 || guessBest > 0}
        <p class="enc__streak">
          guess streak <b>{guessRun}</b>{#if guessBest > 1}
            · best {guessBest}{/if}
        </p>
      {/if}

      <p class="enc__note">
        one encounter a day · shiny odds 1 in {SHINY_ODDS}. name the silhouette
        before you peek — a right guess grows the streak, a wrong one starts it
        over. a couple of requests to pokeapi.co, only when you click; the
        sprite comes from a github mirror.
      </p>

      <button
        class="btn btn--ghost enc__open-dex"
        onclick={onOpenDex}
        title="open the pokedex — {seenCount}/{DEX_MAX} met"
        aria-label="open the pokedex — {seenCount} of {DEX_MAX} met"
      >
        ▦
      </button>
    </div>

    <div class="party">
      <button
        class="party__head"
        onclick={() => (partyOpen = !partyOpen)}
        aria-expanded={partyOpen}
      >
        <span>your party</span>
        <b>{encounter.party.length} / {PARTY_MAX}</b>
        <span class="party__chev" aria-hidden="true"
          >{partyOpen ? "▾" : "▸"}</span
        >
      </button>

      {#if partyOpen}
        {#if replacing}
          <p class="party__ask">
            your party is full — pick one to let go.
            <button class="party__cancel" onclick={() => (replacing = false)}
              >cancel</button
            >
          </p>
        {/if}

        <ul class="party__slots">
          {#each SLOTS as i}
            {@const p = encounter.party[i]}
            <li class="slot" class:filled={!!p} class:pick={replacing && !!p}>
              {#if p}
                {#if guest}
                  {@render face(p)}
                  <span class="slot__name">{display(p)}</span>
                {:else if replacing}
                  <button
                    class="slot__btn"
                    onclick={() => replaceAt(i)}
                    aria-label="let {display(p)} go"
                  >
                    {@render face(p)}
                    <span class="slot__name">{display(p)}</span>
                  </button>
                {:else}
                  {@render face(p)}
                  {#if editing === i}
                    <input
                      class="slot__input"
                      bind:value={draft}
                      maxlength="40"
                      aria-label="rename {species(p)}"
                      use:autoselect
                      onkeydown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitEdit(i);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          editing = null;
                        }
                      }}
                      onblur={() => commitEdit(i)}
                    />
                  {:else}
                    <button
                      class="slot__name slot__name--btn"
                      onclick={() => startEdit(i, p)}
                      title="rename"
                      aria-label="rename {display(p)}"
                    >
                      {display(p)}
                    </button>
                  {/if}
                {/if}
              {:else}
                <span class="slot__empty" aria-hidden="true">·</span>
              {/if}
            </li>
          {/each}
        </ul>

        <p class="party__note">
          {#if guest}
            this party belongs to the room you're visiting — read only.
          {:else}
            click a name to rename it. the party is kept in this browser only,
            and the sprites come from the github mirror as you reach them —
            nothing else loads on its own.
          {/if}
        </p>
      {/if}
    </div>
  </div>
</section>

<style>
  .enc {
    display: grid;
    gap: 14px;
  }

  .enc__screen {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 176px;
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
    background:
      radial-gradient(
        120% 90% at 50% 130%,
        color-mix(in srgb, var(--leaf) 20%, transparent),
        transparent 62%
      ),
      linear-gradient(180deg, var(--bg-2), var(--bg));
    box-shadow: inset 0 0 40px -14px
      color-mix(in srgb, var(--leaf) 50%, transparent);
    overflow: hidden;
  }
  /* a shiny gets the room to itself — gold light, no extra animation */
  .enc__screen.is-shiny {
    background:
      radial-gradient(
        120% 90% at 50% 130%,
        color-mix(in srgb, var(--gold) 22%, transparent),
        transparent 62%
      ),
      linear-gradient(180deg, var(--bg-2), var(--bg));
    box-shadow: inset 0 0 40px -14px
      color-mix(in srgb, var(--gold) 55%, transparent);
  }

  .enc__grass {
    position: absolute;
    inset: auto 0 0 0;
    height: 52px;
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0 6px,
        color-mix(in srgb, var(--leaf) 18%, transparent) 6px 7px
      ),
      linear-gradient(
        180deg,
        transparent,
        color-mix(in srgb, var(--leaf) 14%, transparent)
      );
    mask-image: linear-gradient(180deg, transparent, #000 62%);
  }
  .enc__screen.is-shiny .enc__grass {
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0 6px,
        color-mix(in srgb, var(--gold) 18%, transparent) 6px 7px
      ),
      linear-gradient(
        180deg,
        transparent,
        color-mix(in srgb, var(--gold) 14%, transparent)
      );
  }

  .enc__sprite {
    position: relative;
    width: 128px;
    height: 128px;
    image-rendering: pixelated;
    filter: drop-shadow(
      0 0 18px color-mix(in srgb, var(--lime) 35%, transparent)
    );
    animation: appear 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.3);
  }
  .enc__screen.is-shiny .enc__sprite {
    filter: drop-shadow(
      0 0 22px color-mix(in srgb, var(--gold) 75%, transparent)
    );
  }
  /* the silhouette: the sprite flattened to a pale shape, so the name
     is the only way to know who it is */
  .enc__sprite--mystery {
    filter: brightness(0) invert(1) opacity(0.82)
      drop-shadow(0 0 16px color-mix(in srgb, var(--cyan) 45%, transparent));
  }
  .enc__screen.is-shiny .enc__sprite--mystery {
    filter: brightness(0) invert(1) opacity(0.82)
      drop-shadow(0 0 16px color-mix(in srgb, var(--cyan) 45%, transparent));
  }
  @keyframes appear {
    from {
      opacity: 0;
      transform: scale(0.7) translateY(8px);
    }
  }

  .enc__fallback {
    position: relative;
    font-size: 64px;
    line-height: 1;
    color: var(--ink-faint);
  }

  .enc__wait {
    position: relative;
    font-family: var(--pixel);
    font-size: 19px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }
  .enc__wait--err {
    color: var(--orange);
  }

  .enc__crt {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.26) 0 1px,
        transparent 1px 3px
      ),
      radial-gradient(
        130% 100% at 50% 50%,
        transparent 58%,
        rgba(0, 0, 0, 0.55)
      );
    opacity: 0.55;
  }

  .enc__readout {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 8px 12px;
    background: var(--well);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .enc__dex {
    margin: 0;
    font-family: var(--pixel);
    font-size: 22px;
    line-height: 1;
    color: var(--gold);
    text-shadow: var(--glow-gold);
  }
  .enc__name {
    margin: 0;
    font-family: var(--display);
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .enc__shiny {
    margin-left: auto;
    font-family: var(--pixel);
    font-size: 16px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    text-shadow: var(--glow-gold);
  }

  .enc__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .enc__actions .btn:disabled {
    opacity: 0.55;
    cursor: default;
    transform: none;
  }

  .enc__guess {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    flex: 1 1 100%;
  }
  .enc__guess-input {
    flex: 1 1 160px;
    min-width: 0;
    padding: 8px 10px;
    font-family: var(--mono);
    font-size: 12.5px;
    color: var(--ink);
    background: var(--well);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
  }
  .enc__guess-input:focus {
    outline: none;
    border-color: var(--cyan);
    box-shadow: 0 0 14px -4px color-mix(in srgb, var(--cyan) 70%, transparent);
  }
  .enc__guess-input::placeholder {
    color: var(--ink-faint);
  }

  .enc__verdict {
    flex: 1 1 100%;
    margin: 0;
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.05em;
    color: var(--orange);
  }
  .enc__verdict.ok {
    color: var(--lime);
    text-shadow: var(--glow-lime);
  }
  .enc__verdict b {
    color: var(--ink);
    font-weight: 400;
  }

  .enc__streak {
    margin: 0;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .enc__streak b {
    font-family: var(--pixel);
    font-size: 15px;
    font-weight: 400;
    color: var(--gold);
  }
  .enc__kept {
    font-size: 11.5px;
    letter-spacing: 0.04em;
    color: var(--leaf);
  }
  .enc__note {
    flex: 1 1 220px;
    margin: 0;
    font-size: 10.5px;
    line-height: 1.6;
    color: var(--ink-faint);
  }
  /* the note above grows to fill the row, which pushes this icon button to the
     right edge of the actions row. icon-only, so it stays compact; the count
     lives in the title/aria-label instead of taking up space. */
  .enc__open-dex {
    flex: none;
    align-self: center;
    width: 28px;
    height: 28px;
    padding: 0;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
  }

  /* ---------- the party ---------- */

  .party {
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  .party__head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 0;
    font-family: var(--pixel);
    font-size: 17px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-dim);
    background: none;
    border: 0;
  }
  .party__head:hover {
    color: var(--lime);
  }
  .party__head b {
    font-weight: 400;
    color: var(--gold);
  }
  .party__chev {
    margin-left: auto;
    color: var(--ink-faint);
  }

  .party__ask {
    margin: 10px 0 0;
    font-size: 11.5px;
    color: var(--magenta);
  }
  .party__cancel {
    margin-left: 6px;
    font-size: 11px;
    color: var(--ink-faint);
    background: none;
    border: 0;
    text-decoration: underline;
  }
  .party__cancel:hover {
    color: var(--ink);
  }

  .party__slots {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    margin: 10px 0 0;
    padding: 0;
  }
  .slot {
    position: relative;
    display: grid;
    place-items: center;
    gap: 4px;
    min-height: 104px;
    padding: 8px 4px;
    background: var(--well);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
  }
  .slot.filled {
    border-style: solid;
    border-color: var(--line-hot);
  }
  .slot.pick {
    border-color: var(--magenta);
    box-shadow: 0 0 14px -4px
      color-mix(in srgb, var(--magenta) 70%, transparent);
  }
  .slot__btn {
    display: grid;
    place-items: center;
    gap: 4px;
    width: 100%;
    padding: 0;
    background: none;
    border: 0;
  }
  .slot__sprite {
    width: 64px;
    height: 64px;
    image-rendering: pixelated;
  }
  .slot__fallback {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    font-size: 30px;
    color: var(--ink-faint);
  }
  .slot__name {
    max-width: 100%;
    font-size: 9.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-align: center;
    color: var(--ink-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* the name is a button — a dotted underline on hover is the whole hint */
  .slot__name--btn {
    padding: 0;
    background: none;
    border: 0;
    border-bottom: 1px dotted transparent;
    cursor: text;
  }
  .slot__name--btn:hover,
  .slot__name--btn:focus-visible {
    color: var(--lime);
    border-bottom-color: var(--lime);
  }
  .slot__input {
    width: 100%;
    max-width: 100%;
    padding: 2px 4px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-align: center;
    color: var(--ink);
    background: var(--bg-2);
    border: 1px solid var(--lime);
    border-radius: 2px;
    box-shadow: var(--glow-lime);
    outline: none;
  }
  .slot__shiny {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: 13px;
  }
  .slot__empty {
    font-size: 22px;
    color: var(--ink-faint);
    opacity: 0.5;
  }

  .party__note {
    margin: 10px 0 0;
    font-size: 10px;
    line-height: 1.6;
    color: var(--ink-faint);
  }

  /* six in a row gets cramped on a phone — wrap to two rows of three
     instead, which also lets the sprites stay big */
  @media (max-width: 620px) {
    .party__slots {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .slot {
      min-height: 96px;
    }
    .slot__sprite {
      width: 56px;
      height: 56px;
    }
    .slot__fallback {
      width: 56px;
      height: 56px;
    }
  }
</style>
