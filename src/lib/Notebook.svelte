<script>
  import { onMount } from "svelte";
  import { unlock } from "./achievements.svelte.js";
  import { readStore, writeStore, share } from "./share.svelte.js";
  import { lockScroll, unlockScroll } from "./scroll-lock.js";
  import { trapFocus } from "./focus-trap.js";

  let { open = false, onOpen, onClose } = $props();

  /* ---------- the notes ----------
     A notebook is private, so it does NOT live in the config:
     exporting your "home" should never carry your notes out with
     it. It gets its own localStorage key and its own save loop.

     A page can also be *sealed*: written now, hidden until a future
     day. Sealed pages ride in the same payload, so the whole notebook
     stays one key. */

  const KEY = "yours.notes";
  const MAX = 20000;
  const MAX_SEALED = 50;
  const DAY = 86400000;

  const isSealed = (s) =>
    !!s &&
    typeof s === "object" &&
    Number.isFinite(s.id) &&
    typeof s.text === "string" &&
    typeof s.until === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.until) &&
    Number.isFinite(new Date(`${s.until}T00:00:00`).getTime());

  // a hand-edited payload could repeat an id; the keyed list would choke
  function dedupe(list) {
    const seen = new Set();
    const out = [];
    for (const s of list) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
    return out;
  }

  function load() {
    const raw = readStore(KEY);
    if (typeof raw !== "string" || !raw) return { body: "", sealed: [] };
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    // the first version stored the page as a bare string; adopt it
    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      (typeof data.body === "string" || Array.isArray(data.sealed))
    ) {
      return {
        body: typeof data.body === "string" ? data.body.slice(0, MAX) : "",
        sealed: Array.isArray(data.sealed)
          ? dedupe(data.sealed.filter(isSealed)).slice(0, MAX_SEALED)
          : [],
      };
    }
    return { body: raw.slice(0, MAX), sealed: [] };
  }

  const initial = load();
  let body = $state(initial.body);
  let sealed = $state(initial.sealed);
  let saved = $state(false);
  let confirming = $state(false);
  let sealing = $state(false);
  let sealDate = $state("");
  let sealErr = $state("");
  let burning = $state(null);
  let now = $state(Date.now());
  let saveTimer;
  let flashTimer;
  let confirmTimer;
  let burnTimer;
  let tabEl;

  function save() {
    writeStore(KEY, JSON.stringify({ body, sealed }));
    saved = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (saved = false), 1800);
  }

  function onInput(e) {
    body = e.target.value.slice(0, MAX);
    saved = false;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      save();
      if (body.trim()) unlock("note-taker");
    }, 400);
  }

  function clearPage() {
    // two taps rather than a native confirm(), which would break the spell
    if (!confirming) {
      confirming = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirming = false), 4000);
      return;
    }
    confirming = false;
    body = "";
    saved = false;
    save();
  }

  /* ---------- sealing ---------- */

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function startSeal() {
    if (!body.trim()) return;
    sealing = true;
    sealErr = "";
    sealDate = iso(new Date(Date.now() + 7 * DAY));
  }

  function confirmSeal() {
    const text = body.trim();
    if (!text) {
      sealing = false;
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sealDate)) {
      sealErr = "pick a day";
      return;
    }
    if (new Date(`${sealDate}T00:00:00`).getTime() <= Date.now()) {
      sealErr = "pick a day still to come";
      return;
    }
    sealed = [...sealed, { id: Date.now(), text, until: sealDate }];
    body = "";
    sealing = false;
    save();
    unlock("time-capsule");
  }

  const isOpen = (s) => now >= new Date(`${s.until}T00:00:00`).getTime();

  const daysUntil = (s) =>
    Math.max(
      0,
      Math.ceil((new Date(`${s.until}T00:00:00`).getTime() - now) / DAY),
    );

  function moveToPage(s) {
    body = (body ? `${body}\n\n${s.text}` : s.text).slice(0, MAX);
    sealed = sealed.filter((x) => x.id !== s.id);
    save();
  }

  function burn(s) {
    // the same two-tap courtesy as clearing the page
    if (burning !== s.id) {
      burning = s.id;
      clearTimeout(burnTimer);
      burnTimer = setTimeout(() => (burning = null), 4000);
      return;
    }
    burning = null;
    sealed = sealed.filter((x) => x.id !== s.id);
    save();
  }

  function close() {
    onClose();
    tabEl?.focus();
  }

  const today = new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toLowerCase();

  onMount(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(saveTimer);
      clearTimeout(flashTimer);
      clearTimeout(confirmTimer);
      clearTimeout(burnTimer);
    };
  });

  // refresh the clock when the drawer opens, so a page that came due
  // while you were away is already open when you look
  $effect(() => {
    if (open) now = Date.now();
  });

  // a guest link swaps the notebook out from under us
  $effect(() => {
    share.payload;
    const next = load();
    body = next.body;
    sealed = next.sealed;
  });

  // keep the page behind the drawer still while it is open
  $effect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  });
</script>

<!-- the notebook, tucked under the left edge of the screen. Only the
     fore-edge shows until you reach for it. -->
<button
  class="nb"
  bind:this={tabEl}
  onclick={onOpen}
  aria-label="open your notebook"
  aria-haspopup="dialog"
  aria-expanded={open}
  title="your notebook — it stays in this browser"
>
  <span class="nb__pages" aria-hidden="true"></span>
  <span class="nb__title">notes</span>
  <span class="nb__sub">stays in this browser</span>
  <span class="nb__mark" aria-hidden="true">✎</span>
  <span class="nb__ribbon" aria-hidden="true"></span>
</button>

{#if open}
  <div
    class="veil"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) close();
    }}
  >
    <div
      class="drawer"
      role="dialog"
      aria-modal="true"
      aria-label="your notebook"
      tabindex="-1"
      use:trapFocus
    >
      <div class="panel__bar">
        <span class="panel__title">notes.txt</span>
        <span class="drawer__spacer"></span>
        <span class="drawer__tag">local only</span>
        <button
          class="drawer__x"
          onclick={close}
          aria-label="close the notebook">✕</button
        >
      </div>

      <div class="drawer__body">
        <p class="drawer__hint">
          this page is yours. write anything — it stays in this browser, and it
          is not part of your config, so it never travels with it. seal a page
          and it stays hidden until the day you choose.
        </p>

        <div class="paper">
          <span class="paper__date">{today}</span>
          <textarea
            class="paper__area"
            value={body}
            oninput={onInput}
            maxlength={MAX}
            spellcheck="false"
            placeholder="write anything. it stays here."
            aria-label="your notes"></textarea>
        </div>

        <div class="sealbar">
          {#if !sealing}
            <button class="sealbtn" onclick={startSeal} disabled={!body.trim()}>
              ✉ seal this page for later
            </button>
          {:else}
            <div class="sealform">
              <label class="sealform__label" for="sealdate">open it on</label>
              <input
                id="sealdate"
                class="sealform__date"
                type="date"
                min={iso(new Date(Date.now() + DAY))}
                bind:value={sealDate}
              />
              <button class="sealform__go" onclick={confirmSeal}>seal it</button
              >
              <button class="sealform__no" onclick={() => (sealing = false)}
                >cancel</button
              >
            </div>
            {#if sealErr}<p class="sealform__err">{sealErr}</p>{/if}
          {/if}
        </div>

        {#if sealed.length}
          <div class="seals">
            <div class="seals__head">
              <span class="seals__title">sealed</span>
              <span class="seals__count">{sealed.length}</span>
            </div>
            <ul class="seals__list">
              {#each sealed as s (s.id)}
                {@const ready = isOpen(s)}
                {@const left = daysUntil(s)}
                <li class="seal" class:open={ready}>
                  <div class="seal__top">
                    <span
                      class="seal__badge"
                      class:seal__badge--locked={!ready}
                    >
                      {ready ? "opened" : "sealed"}
                    </span>
                    <span class="seal__when">{s.until}</span>
                  </div>
                  {#if ready}
                    <p class="seal__text">{s.text}</p>
                    <div class="seal__acts">
                      <button class="seal__act" onclick={() => moveToPage(s)}>
                        move to the page
                      </button>
                      <button
                        class="seal__act seal__act--burn"
                        onclick={() => burn(s)}
                      >
                        {burning === s.id ? "really? tap again" : "let it go"}
                      </button>
                    </div>
                  {:else}
                    <p class="seal__wait">
                      opens in {left}
                      {left === 1 ? "day" : "days"}
                    </p>
                    <div class="seal__acts">
                      <button
                        class="seal__act seal__act--burn"
                        onclick={() => burn(s)}
                      >
                        {burning === s.id ? "really? tap again" : "let it go"}
                      </button>
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      <div class="drawer__foot">
        <span class="drawer__count">{body.length} / {MAX}</span>
        <span class="drawer__saved" class:on={saved}>saved ✓</span>
        <button class="drawer__clear" onclick={clearPage}>
          {confirming ? "really? tap again" : "clear page"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ============================================================
     the tab — a notebook slid under the left edge of the screen
     ============================================================ */

  .nb {
    position: fixed;
    left: 0;
    top: 50%;
    z-index: 40;
    width: 132px;
    height: 178px;
    margin-top: -89px;
    padding: 0;
    text-align: left;
    border: 0;
    border-radius: 0 7px 7px 0;
    background: linear-gradient(
      180deg,
      var(--panel-2),
      var(--panel) 58%,
      var(--bg)
    );
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.07),
      inset -1px 0 0 rgba(0, 0, 0, 0.55),
      0 20px 44px -24px #000;
    /* 98px of the 132 is off-screen; the slide is the only thing that
       moves, so it stays on the compositor */
    transform: translateX(-98px);
    transition: transform 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.08);
    will-change: transform;
  }
  .nb:hover,
  .nb:focus-visible {
    transform: translateX(-12px);
  }
  .nb:focus-visible {
    outline: 2px solid var(--lime);
    outline-offset: 2px;
  }

  /* the fore-edge: cream pages with a fine line per sheet */
  .nb__pages {
    position: absolute;
    top: 9px;
    right: 4px;
    bottom: 9px;
    width: 8px;
    border-radius: 0 2px 2px 0;
    background: repeating-linear-gradient(
      to bottom,
      #f3ead4 0 2px,
      #d5c8a6 2px 3px
    );
    box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.28);
  }

  /* the title lives in the hidden half, so it arrives with the slide */
  .nb__title {
    position: absolute;
    left: 18px;
    top: 50%;
    translate: 0 -50%;
    font-family: var(--pixel);
    font-size: 30px;
    line-height: 1;
    letter-spacing: 0.06em;
    color: var(--gold);
    text-shadow: var(--glow-gold);
  }
  .nb__sub {
    position: absolute;
    left: 20px;
    top: calc(50% + 21px);
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--gold) 55%, transparent);
  }

  /* the one mark that is always on the sliver */
  .nb__mark {
    position: absolute;
    left: 101px;
    top: 50%;
    translate: 0 -50%;
    font-size: 14px;
    color: var(--gold);
    text-shadow: var(--glow-gold);
    opacity: 0.85;
  }

  .nb__ribbon {
    position: absolute;
    right: 24px;
    bottom: -15px;
    width: 10px;
    height: 32px;
    background: linear-gradient(
      180deg,
      var(--magenta),
      color-mix(in srgb, var(--magenta) 60%, #000)
    );
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 74%, 0 100%);
    box-shadow: 0 6px 12px -6px #000;
    transform-origin: top center;
    transition: transform 0.34s ease;
  }
  .nb:hover .nb__ribbon {
    transform: rotate(4deg);
  }

  /* below the width where the rail would collide with it, the tab
     steps aside — the site map carries a "notes" entry instead */
  @media (max-width: 1200px) {
    .nb {
      display: none;
    }
  }

  /* ============================================================
     the drawer
     ============================================================ */

  .veil {
    position: fixed;
    inset: 0;
    z-index: 270;
    background: color-mix(in srgb, var(--bg) 55%, transparent);
    animation: fade 0.18s ease;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  .drawer {
    position: absolute;
    inset: 0 auto 0 0;
    display: flex;
    flex-direction: column;
    width: min(440px, 94vw);
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border-right: 1px solid var(--line-hot);
    box-shadow:
      0 0 0 1px #000,
      0 0 70px -18px color-mix(in srgb, var(--leaf) 45%, transparent),
      30px 0 60px -40px #000;
    animation: slide 0.26s cubic-bezier(0.2, 0.9, 0.3, 1.05);
  }
  @keyframes slide {
    from {
      transform: translateX(-100%);
    }
  }

  .drawer__spacer {
    flex: 1;
  }
  .drawer__tag {
    font-family: var(--pixel);
    font-size: 16px;
    color: var(--leaf);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
    padding: 0 7px;
  }
  .drawer__x {
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
  .drawer__x:hover {
    background: color-mix(in srgb, var(--orange) 30%, transparent);
  }

  .drawer__body {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
    scrollbar-width: thin;
  }

  .drawer__hint {
    margin: 0 0 12px;
    font-size: 11.5px;
    line-height: 1.7;
    color: var(--ink-dim);
  }

  /* ---------- the page itself ---------- */

  .paper {
    position: relative;
    padding: 16px 16px 16px 46px;
    background: #efe6cf;
    border: 1px solid #c9bc99;
    border-radius: 3px;
    box-shadow:
      inset 0 0 46px -22px rgba(90, 70, 30, 0.55),
      0 14px 30px -24px #000;
  }
  /* the red margin rule */
  .paper::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 38px;
    width: 1px;
    background: rgba(198, 68, 88, 0.42);
  }

  .paper__date {
    display: block;
    margin-bottom: 8px;
    font-family: var(--pixel);
    font-size: 17px;
    letter-spacing: 0.05em;
    color: #8a6d3b;
  }

  .paper__area {
    display: block;
    width: 100%;
    min-height: 48vh;
    padding: 0;
    font: inherit;
    font-size: 13.5px;
    line-height: 28px;
    color: #2c2417;
    background-color: transparent;
    /* the rules scroll with the words, so they stay under the text */
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0 27px,
      rgba(70, 110, 150, 0.24) 27px 28px
    );
    background-attachment: local;
    border: 0;
    outline: none;
    resize: vertical;
  }
  .paper__area::placeholder {
    color: rgba(44, 36, 23, 0.32);
  }

  /* ---------- sealing ---------- */

  .sealbar {
    margin-top: 14px;
  }
  .sealbtn {
    width: 100%;
    padding: 8px 12px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gold);
    background: color-mix(in srgb, var(--gold) 8%, transparent);
    border: 1px dashed color-mix(in srgb, var(--gold) 45%, transparent);
    border-radius: 3px;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }
  .sealbtn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--gold) 16%, transparent);
    border-color: color-mix(in srgb, var(--gold) 70%, transparent);
  }
  .sealbtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sealform {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 9px 11px;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
  }
  .sealform__label {
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .sealform__date {
    flex: 1;
    min-width: 130px;
    padding: 5px 8px;
    font: inherit;
    font-size: 12px;
    color: var(--ink);
    background: var(--well);
    border: 1px solid var(--line);
    border-radius: 3px;
    color-scheme: dark;
  }
  .sealform__go,
  .sealform__no {
    padding: 5px 10px;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: 3px;
  }
  .sealform__go {
    color: var(--lime);
    background: color-mix(in srgb, var(--lime) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--lime) 50%, transparent);
  }
  .sealform__go:hover {
    background: color-mix(in srgb, var(--lime) 24%, transparent);
  }
  .sealform__no {
    color: var(--ink-faint);
    background: none;
    border: 1px solid var(--line);
  }
  .sealform__no:hover {
    color: var(--ink-dim);
  }
  .sealform__err {
    margin: 7px 0 0;
    font-size: 11px;
    color: var(--orange);
  }

  .seals {
    margin-top: 18px;
  }
  .seals__head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 9px;
  }
  .seals__title {
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.05em;
    color: var(--gold);
  }
  .seals__count {
    font-family: var(--pixel);
    font-size: 14px;
    color: var(--ink-faint);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 0 6px;
  }
  .seals__list {
    display: grid;
    gap: 9px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .seal {
    padding: 10px 12px;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line);
    border-left: 3px solid var(--line-hot);
    border-radius: 3px;
  }
  .seal.open {
    border-left-color: var(--lime);
    box-shadow: 0 0 24px -14px color-mix(in srgb, var(--lime) 60%, transparent);
  }
  .seal__top {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .seal__badge {
    font-size: 9.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--lime);
    border: 1px solid color-mix(in srgb, var(--lime) 45%, transparent);
    border-radius: 3px;
    padding: 1px 6px;
  }
  .seal__badge--locked {
    color: var(--gold);
    border-color: color-mix(in srgb, var(--gold) 45%, transparent);
  }
  .seal__when {
    margin-left: auto;
    font-family: var(--pixel);
    font-size: 15px;
    color: var(--ink-faint);
  }
  .seal__wait {
    margin: 8px 0 0;
    font-size: 11.5px;
    color: var(--ink-dim);
  }
  .seal__text {
    margin: 9px 0 0;
    font-size: 12.5px;
    line-height: 1.7;
    color: var(--ink);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .seal__acts {
    display: flex;
    gap: 8px;
    margin-top: 11px;
  }
  .seal__act {
    padding: 4px 9px;
    font-size: 10.5px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-dim);
    background: none;
    border: 1px solid var(--line);
    border-radius: 3px;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }
  .seal__act:hover {
    color: var(--lime);
    border-color: color-mix(in srgb, var(--lime) 50%, transparent);
  }
  .seal__act--burn:hover {
    color: var(--orange);
    border-color: color-mix(in srgb, var(--orange) 55%, transparent);
  }

  /* ---------- the foot ---------- */

  .drawer__foot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-top: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.25);
  }
  .drawer__count {
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
  }
  .drawer__saved {
    font-size: 11px;
    color: var(--leaf);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .drawer__saved.on {
    opacity: 1;
  }
  .drawer__clear {
    margin-left: auto;
    padding: 5px 10px;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
    background: none;
    border: 1px solid var(--line);
    border-radius: 3px;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }
  .drawer__clear:hover {
    color: var(--orange);
    border-color: color-mix(in srgb, var(--orange) 55%, transparent);
  }
</style>
