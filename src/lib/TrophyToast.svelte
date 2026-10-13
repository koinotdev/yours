<script>
  import { onMount } from "svelte";

  // A small window that slides in when a trophy lands. It listens on the
  // window for the event the store fires, so nothing has to be threaded
  // through the tree — the same trick secret.js uses.
  let items = $state([]);
  let uid = 0;
  const timers = new Map();

  const LIFE = 5200;
  const MAX = 3;

  function drop(key) {
    clearTimeout(timers.get(key));
    timers.delete(key);
    items = items.filter((i) => i.key !== key);
  }

  onMount(() => {
    const onUnlock = (e) => {
      const t = e.detail;
      if (!t) return;
      const key = ++uid;
      // keep the newest few; a burst of unlocks should not fill the screen
      const next = [...items, { ...t, key }];
      for (const stale of next.slice(0, Math.max(0, next.length - MAX)))
        drop(stale.key);
      items = next.slice(-MAX);
      timers.set(
        key,
        setTimeout(() => drop(key), LIFE),
      );
    };
    window.addEventListener("trophy:unlocked", onUnlock);
    return () => {
      window.removeEventListener("trophy:unlocked", onUnlock);
      for (const id of timers.values()) clearTimeout(id);
    };
  });
</script>

<div class="toasts" aria-live="polite">
  {#each items as t (t.key)}
    <div class="toast" style="--c:{t.c}">
      <span class="toast__icon" aria-hidden="true">{t.icon}</span>

      <div class="toast__copy">
        <p class="toast__tag">trophy unlocked</p>
        <p class="toast__name">{t.name}</p>
        <p class="toast__desc">{t.desc}</p>
      </div>

      <button class="toast__x" onclick={() => drop(t.key)} aria-label="dismiss"
        >✕</button
      >
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 14px;
    /* the cassette deck shares this corner; it publishes --deck-h so
       the toasts stack above it. the fallback keeps them in the corner
       when the deck is not on screen (a guest view, say). */
    bottom: calc(14px + var(--deck-h, 0px));
    z-index: 65;
    display: grid;
    gap: 8px;
    width: min(300px, calc(100vw - 28px));
    pointer-events: none;
  }

  .toast {
    position: relative;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 16px;
    align-items: start;
    gap: 10px;
    padding: 9px 10px;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid color-mix(in srgb, var(--c) 55%, var(--line-hot));
    border-radius: var(--radius);
    box-shadow:
      0 0 0 1px #000,
      0 0 30px -10px color-mix(in srgb, var(--c) 70%, transparent),
      0 18px 34px -24px #000;
    pointer-events: auto;
    animation: toast-in 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.15);
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(-14px);
    }
  }

  .toast__icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    font-size: 17px;
    line-height: 1;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 50%, transparent);
    border-radius: 3px;
    text-shadow: 0 0 9px color-mix(in srgb, var(--c) 65%, transparent);
  }

  .toast__copy {
    min-width: 0;
  }
  .toast__tag {
    margin: 0 0 2px;
    font-family: var(--pixel);
    font-size: 14px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--c);
    text-shadow: 0 0 6px color-mix(in srgb, var(--c) 55%, transparent);
  }
  .toast__name {
    margin: 0 0 2px;
    font-family: var(--display);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .toast__desc {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink-dim);
  }

  .toast__x {
    padding: 0;
    font-size: 10px;
    line-height: 1.6;
    color: var(--ink-faint);
    background: none;
    border: 0;
  }
  .toast__x:hover {
    color: var(--orange);
  }

  @media (max-width: 620px) {
    .toasts {
      left: 10px;
      bottom: calc(10px + var(--deck-h, 0px));
    }
  }
</style>
