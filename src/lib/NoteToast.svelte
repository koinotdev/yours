<script>
  import { onMount } from "svelte";

  // A small note that slides in at the top-right when a sticky note
  // lands. It listens on the window for the event the store fires, the
  // same trick the trophy toasts use, so nothing is threaded through
  // the tree. Clicking it opens the drawer.
  let { onOpen } = $props();

  let items = $state([]);
  let uid = 0;
  const timers = new Map();

  const LIFE = 6500;
  const MAX = 3;

  function drop(key) {
    clearTimeout(timers.get(key));
    timers.delete(key);
    items = items.filter((i) => i.key !== key);
  }

  function open(n) {
    onOpen?.();
    drop(n.key);
  }

  onMount(() => {
    const onNote = (e) => {
      const note = e.detail;
      if (!note) return;
      const key = ++uid;
      // keep the newest few; a burst should not fill the screen
      const next = [...items, { ...note, key }];
      for (const stale of next.slice(0, Math.max(0, next.length - MAX)))
        drop(stale.key);
      items = next.slice(-MAX);
      timers.set(
        key,
        setTimeout(() => drop(key), LIFE),
      );
    };
    window.addEventListener("sticky:note", onNote);
    return () => {
      window.removeEventListener("sticky:note", onNote);
      for (const id of timers.values()) clearTimeout(id);
    };
  });
</script>

<div class="toasts" aria-live="polite">
  {#each items as n (n.key)}
    <button class="toast" onclick={() => open(n)}>
      <span class="toast__mark" aria-hidden="true">✉</span>
      <span class="toast__copy">
        <span class="toast__tag">a sticky note arrived</span>
        <span class="toast__body">{n.body}</span>
      </span>
      <span class="toast__open" aria-hidden="true">open ▸</span>
    </button>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 14px;
    /* clear of the sticky status strip */
    top: 62px;
    z-index: 66;
    display: grid;
    gap: 8px;
    width: min(320px, calc(100vw - 28px));
    pointer-events: none;
  }

  .toast {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
    padding: 9px 10px;
    text-align: left;
    background: linear-gradient(180deg, #fff3c4, #ffe27a);
    border: 1px solid #d9b64a;
    border-radius: var(--radius);
    box-shadow:
      0 0 0 1px #000,
      0 0 30px -10px color-mix(in srgb, var(--gold) 70%, transparent),
      0 18px 34px -24px #000;
    pointer-events: auto;
    animation: toast-in 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.15);
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(14px);
    }
  }
  .toast:hover {
    background: linear-gradient(180deg, #fff8d8, #ffe98f);
  }

  .toast__mark {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    font-size: 17px;
    line-height: 1;
    color: #4a3405;
    background: rgba(255, 255, 255, 0.42);
    border: 1px solid rgba(74, 52, 5, 0.28);
    border-radius: 3px;
  }

  .toast__copy {
    min-width: 0;
  }
  .toast__tag {
    display: block;
    margin-bottom: 2px;
    font-family: var(--pixel);
    font-size: 14px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8a3b1e;
  }
  .toast__body {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.5;
    color: #2c2417;
    word-break: break-word;
  }

  .toast__open {
    align-self: center;
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(74, 52, 5, 0.72);
  }

  @media (max-width: 620px) {
    .toasts {
      right: 10px;
      top: 58px;
    }
  }
</style>
