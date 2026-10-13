<script>
  import { onMount } from "svelte";
  import {
    config,
    exportConfig,
    importConfig,
    resetConfig,
    storageAvailable,
    MARQUEE_MAX,
    NOW_MAX,
  } from "./config.svelte.js";
  import { THEMES, THEME_IDS } from "./theme.js";
  import { unlock } from "./achievements.svelte.js";
  import { lockScroll, unlockScroll } from "./scroll-lock.js";
  import { trapFocus } from "./focus-trap.js";
  import {
    WINDOW_LABELS,
    windowState,
    setWindow,
    resetOrder,
  } from "./windows.svelte.js";
  import { measureStorage } from "./storage.js";
  import {
    isGuest,
    buildShareURL,
    VIEW_KEYS,
    MAX_ENCODED,
  } from "./share.svelte.js";

  let { onClose } = $props();

  let fileEl = $state();
  let note = $state(null);
  let confirming = $state(false);
  let ok = $state(true);

  /* --- the storage ledger -------------------------------------------
     The config is debounced on write, so feed the live snapshot in
     rather than reading back the last flushed value: the number then
     tracks what you are typing, not what was last saved. */

  const storage = $derived(
    measureStorage({ "yours.config": JSON.stringify(config) }),
  );
  const usedPct = $derived(
    storage ? Math.min(100, (storage.total / storage.budget) * 100) : 0,
  );

  // decimal units, to match the page-weight badge
  const fmtBytes = (n) => {
    if (n < 1000) return `${n} b`;
    if (n < 1000 * 1000) return `${(n / 1000).toFixed(1)} kb`;
    return `${(n / 1000 / 1000).toFixed(1)} mb`;
  };

  /* --- the two list fields ------------------------------------------
     They are stored as arrays but edited as free text, so they keep a
     local string: that way a half-typed line survives a re-render, and
     only an outside change (import / reset) rewrites what you see. */

  const toLines = (s) =>
    s
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  function toRows(s) {
    const out = [];
    for (const raw of s.split("\n")) {
      const l = raw.trim();
      const i = l.indexOf(":");
      if (i === -1) continue;
      const k = l.slice(0, i).trim();
      const v = l.slice(i + 1).trim();
      if (k || v) out.push([k, v]);
    }
    return out;
  }

  const fmtRow = ([k, v]) => `${k}: ${v}`;

  let marqueeText = $state(config.marquee.join("\n"));
  let nowText = $state(config.now.map(fmtRow).join("\n"));

  $effect(() => {
    const fromConfig = config.marquee.slice(0, MARQUEE_MAX).join("\n");
    if (toLines(marqueeText).slice(0, MARQUEE_MAX).join("\n") !== fromConfig) {
      marqueeText = fromConfig;
    }
  });

  $effect(() => {
    const fromConfig = config.now.slice(0, NOW_MAX).map(fmtRow).join("\n");
    if (
      toRows(nowText).slice(0, NOW_MAX).map(fmtRow).join("\n") !== fromConfig
    ) {
      nowText = fromConfig;
    }
  });

  function onMarquee(e) {
    marqueeText = e.target.value;
    config.marquee = toLines(marqueeText).slice(0, MARQUEE_MAX);
  }

  function onNow(e) {
    nowText = e.target.value;
    config.now = toRows(nowText).slice(0, NOW_MAX);
  }

  /* --- download / load / reset ------------------------------------- */

  let noteTimer;
  let confirmTimer;
  function flash(kind, text) {
    note = { kind, text };
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note = null), 4200);
  }

  function download() {
    exportConfig();
    unlock("architect");
    flash("ok", "saved to your downloads.");
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const res = importConfig(await file.text());
      if (res.ok) flash("ok", "config loaded. this is yours now.");
      else flash("bad", res.error);
    } catch {
      flash("bad", "couldn't read that file.");
    }
  }

  function doReset() {
    // two taps rather than a native confirm(), which would break the spell
    if (!confirming) {
      confirming = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirming = false), 4000);
      return;
    }
    resetConfig();
    confirming = false;
    flash("ok", "back to the beginning.");
  }

  /* --- share ---------------------------------------------------------
     A link carries the room in its fragment: the config, the view-only
     stores, and whichever opt-in stores are ticked. Nothing is sent to
     a server — the fragment never leaves the browser until you hand the
     link to someone. */

  let shareNotes = $state(false);
  let shareDoodle = $state(false);
  let shareLink = $state("");
  let shareBusy = $state(false);
  let shareErr = $state("");

  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  // the notebook is shared without its sealed pages: a seal is a promise
  // to keep something hidden until a day, and a url would break it
  function shareableNotes(raw) {
    try {
      const d = JSON.parse(raw);
      if (d && typeof d === "object" && !Array.isArray(d)) {
        return JSON.stringify({
          body: typeof d.body === "string" ? d.body : "",
          sealed: [],
        });
      }
    } catch {
      /* not the shape we know — share it as it is */
    }
    return raw;
  }

  function collectStores() {
    const stores = {};
    for (const key of VIEW_KEYS) {
      const v = read(key);
      if (typeof v === "string") stores[key] = v;
    }
    if (shareNotes) {
      const v = read("yours.notes");
      if (typeof v === "string") stores["yours.notes"] = shareableNotes(v);
    }
    if (shareDoodle) {
      const v = read("yours.doodle");
      if (typeof v === "string") stores["yours.doodle"] = v;
    }
    return stores;
  }

  async function makeLink() {
    shareBusy = true;
    shareErr = "";
    shareLink = "";
    try {
      const payload = {
        v: 1,
        config: JSON.parse(JSON.stringify(config)),
        stores: collectStores(),
      };
      const url = await buildShareURL(payload);
      // the fragment is capped on the way in, so refuse to hand out a
      // link that would not open
      if (url.length > MAX_ENCODED) {
        shareErr =
          "that is too big to fit in a link — a large drawing is the usual culprit. try a smaller one, or share it as a png.";
      } else {
        shareLink = url;
      }
    } catch {
      shareErr = "couldn't build the link.";
    } finally {
      shareBusy = false;
    }
  }

  async function copyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      flash("ok", "link copied — send it to whoever you like.");
    } catch {
      flash(
        "bad",
        "couldn't copy automatically — select the link and copy it.",
      );
    }
  }

  onMount(() => {
    ok = storageAvailable();
    lockScroll();

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(noteTimer);
      clearTimeout(confirmTimer);
      unlockScroll();
    };
  });
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
    aria-label="settings"
    tabindex="-1"
    use:trapFocus
  >
    <div class="panel__bar">
      <span class="panel__title">settings.cfg</span>
      <span class="dlg__spacer"></span>
      <span class="dlg__tag">local only</span>
      <button class="dlg__x" onclick={onClose} aria-label="close settings"
        >✕</button
      >
    </div>

    <div class="dlg__body">
      {#if isGuest()}
        <p class="warn">
          you're visiting someone else's room, so settings are read only. use
          "make it mine" in the banner to keep a copy of this room as yours.
        </p>
      {:else}
        <p class="intro">
          this page keeps its settings in your browser and nowhere else. change
          anything below — it updates as you type, and it will still be here
          tomorrow.
        </p>

        {#if !ok}
          <p class="warn">
            heads up: this browser won't let the page remember anything (private
            mode?). your changes will work, then vanish when you leave.
          </p>
        {/if}

        <p class="grp">identity</p>
        <div class="duo">
          <label class="f">
            <span>big name</span>
            <input
              data-autofocus
              bind:value={config.identity.name}
              maxlength="32"
            />
          </label>
          <label class="f">
            <span>page title</span>
            <input bind:value={config.identity.title} maxlength="32" />
          </label>
        </div>
        <label class="f">
          <span>top-bar slogan</span>
          <input bind:value={config.identity.slogan} maxlength="60" />
        </label>
        <label class="f">
          <span>tagline <em>— wrap a word in *stars* to tint it</em></span>
          <input bind:value={config.identity.tagline} maxlength="260" />
        </label>
        <label class="f">
          <span>status line</span>
          <input bind:value={config.identity.status} maxlength="90" />
        </label>

        <p class="grp">welcome</p>
        <label class="f">
          <span>heading</span>
          <input bind:value={config.welcome.heading} maxlength="60" />
        </label>
        <label class="f">
          <span>note to whoever arrives</span>
          <textarea bind:value={config.welcome.body} rows="7" maxlength="900"
          ></textarea>
        </label>

        <p class="grp">atmosphere</p>
        <p class="sub">palette</p>
        <div class="themes">
          {#each THEME_IDS as id}
            <button
              class="theme"
              class:on={config.theme === id}
              onclick={() => {
                config.theme = id;
                unlock("customizer");
              }}
              aria-pressed={config.theme === id}
              title={id}
            >
              <span class="theme__dots">
                {#each Object.values(THEMES[id].vars) as c}<i
                    style="background:{c}"
                  ></i>{/each}
              </span>
              <span class="theme__name">{THEMES[id].label}</span>
            </button>
          {/each}
        </div>

        <div class="f">
          <span>time of day <em>— the light follows your clock</em></span>
          <button
            class="toggle"
            class:on={config.lighting}
            onclick={() => (config.lighting = !config.lighting)}
            aria-pressed={config.lighting}
          >
            {config.lighting ? "on" : "off"}
          </button>
          <p class="tiny">
            dawn, day, dusk and night each wash the room in a different light,
            mixed from the palette above — so the light changes with the theme
            too.
          </p>
        </div>

        <label class="f">
          <span>marquee <em>— one phrase per line</em></span>
          <textarea
            value={marqueeText}
            oninput={onMarquee}
            rows="4"
            maxlength="1200"></textarea>
        </label>
        <label class="f">
          <span
            >currently <em>— one per line, like "building: small things"</em
            ></span
          >
          <textarea value={nowText} oninput={onNow} rows="4" maxlength="700"
          ></textarea>
        </label>

        <p class="grp">arrival</p>
        <div class="f">
          <span>greeting <em>— play your synth tape as you arrive</em></span>
          <button
            class="toggle"
            class:on={config.arrival.play}
            onclick={() => (config.arrival.play = !config.arrival.play)}
            aria-pressed={config.arrival.play}
          >
            {config.arrival.play ? "♪ on" : "off"}
          </button>
          <p class="tiny">
            record a take in synth.exe first, then turn this on. browsers won't
            let sound start on its own, so it plays on your first click or
            keypress — skipping the boot screen counts.
          </p>
        </div>

        <p class="grp">windows</p>
        <p class="sub">sections you reduced or closed — bring them back here</p>
        <div class="wins">
          {#each config.order as id (id)}
            {@const state = windowState(id)}
            <div class="win" class:is-open={state === "open"}>
              <span class="win__name">{WINDOW_LABELS[id]}</span>
              <span class="win__state">{state}</span>
              <button
                class="win__btn"
                onclick={() => setWindow(id, "open")}
                disabled={state === "open"}
              >
                restore
              </button>
            </div>
          {/each}
          <div class="win">
            <span class="win__name">order</span>
            <span class="win__state">sections, top to bottom</span>
            <button class="win__btn" onclick={resetOrder}>reset order</button>
          </div>
        </div>

        <p class="grp">storage</p>
        <p class="sub">what this page is keeping in your browser</p>
        {#if storage}
          <div class="store">
            <div class="store__head">
              <span class="store__total">{fmtBytes(storage.total)}</span>
              <span class="store__of"
                >of roughly {fmtBytes(storage.budget)}</span
              >
            </div>
            <div
              class="store__bar"
              role="img"
              aria-label={`${fmtBytes(storage.total)} of about ${fmtBytes(storage.budget)} used`}
            >
              <i style="width:{Math.max(1.5, usedPct)}%"></i>
            </div>
            <ul class="store__list">
              {#each storage.entries as e (e.key)}
                <li><span>{e.label}</span><b>{fmtBytes(e.bytes)}</b></li>
              {/each}
              {#if !storage.entries.length}
                <li><span>nothing yet</span><b>0 b</b></li>
              {/if}
            </ul>
            <p class="tiny">
              every key the page owns, counted as utf-16 — two bytes a
              character, the way the browser counts them. nothing here is sent
              anywhere; clearing this site's data wipes it all.
            </p>
          </div>
        {:else}
          <p class="tiny">
            this browser won't let the page look at its own storage.
          </p>
        {/if}

        <p class="grp">share</p>
        <p class="sub">make a link that shows your room to someone else</p>
        <div class="share">
          <label class="share__opt">
            <input type="checkbox" bind:checked={shareNotes} />
            <span>the notebook</span>
          </label>
          <label class="share__opt">
            <input type="checkbox" bind:checked={shareDoodle} />
            <span>the drawing</span>
          </label>
          <p class="tiny">
            everything else — the palette, the words, your trophies, the party,
            the cat — travels automatically. your synth tape and sticky notes
            never leave this browser. whoever opens the link sees your room read
            only, and their own is left untouched.
          </p>
          <div class="share__go">
            <button class="btn" onclick={makeLink} disabled={shareBusy}>
              {shareBusy ? "building…" : "make a link"}
            </button>
            {#if shareLink}
              <button class="btn btn--ghost" onclick={copyLink}
                >copy link</button
              >
            {/if}
          </div>
          {#if shareErr}
            <p class="warn">{shareErr}</p>
          {/if}
          {#if shareLink}
            <textarea class="share__link" readonly value={shareLink} rows="3"
            ></textarea>
            <p class="tiny">
              {shareLink.length} characters. the link lives after the #, so it is
              never sent to a server — but chat apps shorten very long links, so keep
              it short if you can.
            </p>
          {/if}
        </div>

        <p class="foot-hint">
          a config is just a small json file. keep it, carry it to another
          browser, or hand it to a friend — nothing is ever sent anywhere.
        </p>
      {/if}
    </div>

    {#if !isGuest()}
      <div class="dlg__foot">
        <button class="btn btn--ghost" onclick={download}>↓ download</button>
        <button class="btn btn--ghost" onclick={() => fileEl?.click()}
          >↑ load a config</button
        >
        <button class="btn btn--magenta" onclick={doReset}>
          {confirming ? "really? tap again" : "⟲ reset"}
        </button>
        <input
          bind:this={fileEl}
          type="file"
          accept="application/json,.json"
          onchange={onFile}
          hidden
        />
        {#if note}
          <span class="note" class:note--bad={note.kind === "bad"} role="status"
            >{note.text}</span
          >
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
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
    width: min(620px, 100%);
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
    padding: 16px 18px 4px;
    scrollbar-width: thin;
  }

  .intro {
    margin: 0 0 14px;
    font-size: 12.5px;
    line-height: 1.7;
    color: var(--ink-dim);
  }
  .warn {
    margin: 0 0 14px;
    padding: 8px 10px;
    font-size: 11.5px;
    line-height: 1.6;
    color: var(--gold);
    background: color-mix(in srgb, var(--gold) 8%, transparent);
    border: 1px dashed color-mix(in srgb, var(--gold) 45%, transparent);
    border-radius: 3px;
  }

  .grp {
    margin: 22px 0 10px;
    padding-bottom: 4px;
    font-family: var(--pixel);
    font-size: 18px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gold);
    text-shadow: var(--glow-gold);
    border-bottom: 1px dashed var(--line-hot);
  }
  .sub {
    margin: 0 0 8px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  .duo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .f {
    display: block;
    margin-bottom: 12px;
  }
  .f > span {
    display: block;
    margin-bottom: 5px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .f em {
    font-style: normal;
    text-transform: none;
    letter-spacing: 0;
    color: color-mix(in srgb, var(--ink-faint) 70%, transparent);
  }
  .f input,
  .f textarea {
    width: 100%;
    padding: 8px 10px;
    font: inherit;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--ink);
    background: var(--well);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
    resize: vertical;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }
  .f input:focus,
  .f textarea:focus {
    outline: none;
    border-color: var(--lime);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--lime) 14%, transparent);
  }

  .themes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  .theme {
    display: grid;
    gap: 6px;
    justify-items: center;
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: 3px;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;
  }
  .theme:hover {
    transform: translateY(-2px);
    border-color: var(--line-hot);
  }
  .theme.on {
    border-color: var(--lime);
    box-shadow: 0 0 14px -4px color-mix(in srgb, var(--lime) 70%, transparent);
  }
  .theme__dots {
    display: flex;
    gap: 2px;
  }
  .theme__dots i {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.4);
  }
  .theme__name {
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.06em;
    color: var(--ink-dim);
  }
  .theme.on .theme__name {
    color: var(--lime);
  }

  .foot-hint {
    margin: 18px 0 14px;
    font-size: 10.5px;
    line-height: 1.65;
    color: var(--ink-faint);
  }

  .store {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .store__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .store__total {
    font-family: var(--pixel);
    font-size: 20px;
    letter-spacing: 0.05em;
    color: var(--leaf);
  }
  .store__of {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .store__bar {
    height: 6px;
    margin: 8px 0 10px;
    background: var(--well);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
    overflow: hidden;
  }
  .store__bar i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--leaf), var(--lime));
  }
  .store__list {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 11.5px;
  }
  .store__list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--ink-faint);
  }
  .store__list b {
    color: var(--ink-dim);
    font-weight: 700;
  }

  .wins {
    display: grid;
    gap: 6px;
  }
  .win {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .win.is-open {
    opacity: 0.55;
  }
  .win__name {
    font-family: var(--pixel);
    font-size: 16px;
    letter-spacing: 0.05em;
    color: var(--ink-dim);
  }
  .win__state {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .win__btn {
    padding: 4px 10px;
    font-family: var(--mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--lime);
    background: color-mix(in srgb, var(--lime) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--lime) 45%, transparent);
    border-radius: 3px;
    transition: background 0.15s ease;
  }
  .win__btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--lime) 22%, transparent);
  }
  .win__btn:disabled {
    color: var(--ink-faint);
    background: none;
    border-color: var(--line);
    cursor: default;
  }

  .toggle {
    padding: 7px 16px;
    font-family: var(--pixel);
    font-size: 17px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
    background: var(--well);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
    transition:
      color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease;
  }
  .toggle:hover {
    color: var(--ink);
  }
  .toggle.on {
    color: var(--on-accent);
    background: var(--lime);
    border-color: var(--lime);
    box-shadow: var(--glow-lime);
  }
  .tiny {
    margin: 8px 0 0;
    font-size: 10.5px;
    line-height: 1.6;
    color: var(--ink-faint);
  }

  .dlg__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--line);
    background: rgba(0, 0, 0, 0.25);
  }
  .note {
    font-size: 11.5px;
    color: var(--leaf);
  }
  .note--bad {
    color: var(--orange);
  }

  .share {
    display: grid;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .share__opt {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: var(--ink-dim);
    cursor: pointer;
  }
  .share__opt input {
    accent-color: var(--lime);
  }
  .share__go {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .share__link {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-family: var(--mono);
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink-dim);
    background: var(--well);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
    resize: vertical;
    word-break: break-all;
  }

  @media (max-width: 560px) {
    .duo {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }
</style>
