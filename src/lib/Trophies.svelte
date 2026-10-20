<script>
  import { onMount } from "svelte";
  import { TROPHIES, unlocked, has } from "./achievements.svelte.js";
  import { lockScroll, unlockScroll } from "./scroll-lock.js";
  import { trapFocus } from "./focus-trap.js";

  // the rail box is the shelf; the cabinet is the window you open on it
  let open = $state(false);

  const count = $derived(unlocked.length);

  function close() {
    open = false;
  }

  // the rail is `position: sticky`, which makes it a stacking context, so a
  // fixed veil inside it would paint behind the main column. teleport the
  // cabinet to <body> instead, where it can sit above everything.
  function portal(node) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  onMount(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // keep the page behind the cabinet still while it is open
  $effect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  });
</script>

<div class="box">
  <p class="box__head" style="--c:var(--violet)">trophy cabinet</p>
  <div class="box__body">
    <ul class="shelf" aria-hidden="true">
      {#each TROPHIES as t}
        <li class="shelf__slot" class:on={has(t.id)} style="--c:{t.c}">
          <span class="shelf__icon">{t.icon}</span>
        </li>
      {/each}
    </ul>

    <p class="cab__count">
      <b>{count}</b> / {TROPHIES.length} collected
    </p>

    <button class="cab__open" onclick={() => (open = true)}>
      open the cabinet <span aria-hidden="true">▸</span>
    </button>
  </div>
</div>

{#if open}
  <div
    class="veil"
    use:portal
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) close();
    }}
  >
    <div
      class="dlg"
      role="dialog"
      aria-modal="true"
      aria-label="trophy cabinet"
      tabindex="-1"
      use:trapFocus
    >
      <div class="panel__bar">
        <span class="panel__title">trophy_cabinet.dat</span>
        <span class="dlg__spacer"></span>
        <span class="dlg__tag">{count} / {TROPHIES.length}</span>
        <button class="dlg__x" onclick={close} aria-label="close the cabinet"
          >✕</button
        >
      </div>

      <div class="dlg__body">
        <p class="dlg__intro">
          everything you have done here, and everything you have not. the ones
          you have not earned show only a hint.
        </p>

        <ul class="grid">
          {#each TROPHIES as t}
            {@const got = has(t.id)}
            <li class="card" class:got style="--c:{t.c}">
              <span class="card__icon" aria-hidden="true">{t.icon}</span>
              <div class="card__copy">
                <p class="card__name">{t.name}</p>
                <p class="card__text">{got ? t.desc : t.hint}</p>
              </div>
              <span class="card__mark" aria-hidden="true"
                >{got ? "✓" : "·"}</span
              >
            </li>
          {/each}
        </ul>

        <p class="dlg__foot">
          kept in this browser only. like your notes and your party, it is not
          part of your config, so it never travels with it.
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ---------- the shelf in the rail ---------- */

  .shelf {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(20px, 1fr));
    gap: 3px;
    margin: 0 0 9px;
    padding: 0;
  }
  .shelf__slot {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    font-size: 12px;
    line-height: 1;
    color: var(--ink-faint);
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid var(--line);
    border-radius: 2px;
    /* a dark trophy: the shape is there, the light is not */
    opacity: 0.45;
  }
  .shelf__slot.on {
    color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border-color: color-mix(in srgb, var(--c) 45%, transparent);
    text-shadow: 0 0 7px color-mix(in srgb, var(--c) 60%, transparent);
    opacity: 1;
  }

  .cab__count {
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
  }
  .cab__count b {
    font-family: var(--pixel);
    font-size: 18px;
    font-weight: 400;
    color: var(--violet);
    text-shadow: 0 0 6px color-mix(in srgb, var(--violet) 55%, transparent);
  }

  .cab__open {
    display: block;
    width: 100%;
    padding: 5px 8px;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: left;
    color: var(--violet);
    background: color-mix(in srgb, var(--violet) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--violet) 40%, transparent);
    border-radius: 3px;
    transition:
      background 0.18s ease,
      box-shadow 0.18s ease;
  }
  .cab__open:hover {
    background: color-mix(in srgb, var(--violet) 20%, transparent);
    box-shadow: 0 0 16px -3px color-mix(in srgb, var(--violet) 70%, transparent);
  }

  /* ---------- the cabinet window ---------- */

  .veil {
    position: fixed;
    inset: 0;
    z-index: 275;
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
    width: min(660px, 100%);
    max-height: 90vh;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
    box-shadow:
      0 0 0 1px #000,
      0 0 60px -14px color-mix(in srgb, var(--violet) 45%, transparent),
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
    color: var(--violet);
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

  .dlg__intro {
    margin: 0 0 14px;
    font-size: 12px;
    line-height: 1.7;
    color: var(--ink-dim);
  }

  .grid {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
  }

  .card {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 14px;
    align-items: start;
    gap: 10px;
    padding: 9px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .card.got {
    background: color-mix(in srgb, var(--c) 6%, rgba(0, 0, 0, 0.3));
    border-color: color-mix(in srgb, var(--c) 40%, var(--line));
  }

  .card__icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    font-size: 17px;
    line-height: 1;
    color: var(--ink-faint);
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--line);
    border-radius: 3px;
    opacity: 0.5;
  }
  .card.got .card__icon {
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, transparent);
    border-color: color-mix(in srgb, var(--c) 50%, transparent);
    text-shadow: 0 0 9px color-mix(in srgb, var(--c) 65%, transparent);
    opacity: 1;
  }

  .card__copy {
    min-width: 0;
  }
  .card__name {
    margin: 0 0 2px;
    font-family: var(--display);
    font-weight: 700;
    font-size: 12.5px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .card.got .card__name {
    color: var(--ink);
  }
  .card__text {
    margin: 0;
    font-size: 11px;
    line-height: 1.55;
    color: var(--ink-faint);
  }
  .card.got .card__text {
    color: var(--ink-dim);
  }

  .card__mark {
    font-size: 11px;
    line-height: 1.6;
    text-align: right;
    color: var(--ink-faint);
  }
  .card.got .card__mark {
    color: var(--c);
  }

  .dlg__foot {
    margin: 14px 0;
    font-size: 10.5px;
    line-height: 1.65;
    color: var(--ink-faint);
  }

  @media (max-width: 560px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
