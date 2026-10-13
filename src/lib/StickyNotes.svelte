<script>
  import { onMount } from "svelte";
  import { lockScroll, unlockScroll } from "./scroll-lock.js";
  import { trapFocus } from "./focus-trap.js";
  import StickyNote from "./StickyNote.svelte";
  import {
    notes,
    goOnline,
    goOffline,
    sendNote,
    blockSender,
    unblockSender,
    markRead,
    clearInbox,
    sentToday,
    shortKey,
    MAX_BODY,
  } from "./notes-net.svelte.js";

  let { open = false, onOpen, onClose } = $props();

  let body = $state("");
  let sending = $state(false);
  let result = $state("");
  let clearArmed = $state(false);
  let opened = $state(null); // the single note being read, if any
  let tabEl;
  let clearTimer;

  const online = $derived(notes.status === "online");
  const used = $derived(sentToday());

  async function send() {
    if (sending) return;
    sending = true;
    result = "";
    const r = await sendNote(body);
    sending = false;
    if (r.ok) {
      body = "";
      result = "your note is on its way.";
    } else {
      result = r.error;
    }
  }

  function close() {
    opened = null;
    onClose();
    tabEl?.focus();
  }

  // the same two-tap courtesy the notebook uses for clearing a page
  function armClear() {
    if (!clearArmed) {
      clearArmed = true;
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => (clearArmed = false), 4000);
      return;
    }
    clearArmed = false;
    clearInbox();
  }

  onMount(() => {
    // no "go online" button: the room is joined as soon as the page is
    // here, so a note can find you without you having to ask. stepping
    // away is still yours to choose.
    goOnline();
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // a single note sits on top of the modal; escape closes it first
      if (opened) opened = null;
      else if (open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(clearTimer);
    };
  });

  // opening the modal reads the notes — and a note that lands while
  // it is open is read as it arrives
  $effect(() => {
    if (open && notes.unread) markRead();
  });

  // keep the page behind the modal still while it is open
  $effect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  });
</script>

<!-- a sticky note stuck to the right edge of the screen. most of it is
     off-screen; the fore-edge shows a pencil mark and, when one is
     waiting, a count. reach for it and it slides out. -->
<button
  class="sn"
  bind:this={tabEl}
  onclick={onOpen}
  aria-label="open your sticky notes"
  aria-haspopup="dialog"
  aria-expanded={open}
  title="sticky notes — passed browser to browser"
>
  <span class="sn__fold" aria-hidden="true"></span>
  <span class="sn__mark" aria-hidden="true">✎</span>
  <span class="sn__label">sticky notes</span>
  {#if notes.unread}
    <span class="sn__badge" aria-label="{notes.unread} new">{notes.unread}</span
    >
  {/if}
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
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="sticky notes"
      tabindex="-1"
      use:trapFocus
    >
      <div class="modal__bar">
        <span class="modal__title">sticky notes</span>
        <span class="modal__spacer"></span>
        <span class="modal__tag" class:on={online}>
          {online
            ? `${notes.peers} here`
            : notes.status === "connecting"
              ? "reaching…"
              : "offline"}
        </span>
        <button class="modal__x" onclick={close} aria-label="close sticky notes"
          >✕</button
        >
      </div>

      <div class="modal__body">
        {#if notes.status === "unsupported"}
          <p class="hint">
            this browser cannot sign notes — the page needs a secure context
            (https or localhost) for that.
          </p>
        {:else if online}
          <!-- the note you write. the same paper the read view uses,
               with a marker for a send button. -->
          <div class="desk">
            <StickyNote
              bind:value={body}
              editable
              disabled={used}
              maxlength={MAX_BODY}
              label="your note"
              placeholder={used
                ? "you have sent your note today — come back tomorrow."
                : "write a note to a stranger…"}
            >
              {#snippet foot()}
                <span class="pad__count">{body.length} / {MAX_BODY}</span>
                <button
                  class="pad__send"
                  onclick={send}
                  disabled={used ||
                    sending ||
                    !body.trim() ||
                    notes.peers === 0}
                >
                  {used ? "sent today" : sending ? "sending…" : "send it"}
                </button>
              {/snippet}
            </StickyNote>
          </div>

          <p class="under">
            {#if notes.peers === 0}
              you are the only one here right now. a note needs someone else on
              the page.
            {:else}
              {notes.peers}
              {notes.peers === 1 ? "stranger is" : "strangers are"} here. your note
              goes to one of them, at random.
            {/if}
          </p>
          {#if result}<p class="result">{result}</p>{/if}
        {:else if notes.status === "connecting"}
          <p class="hint">reaching the room…</p>
        {:else}
          <div class="intro">
            <p class="intro__lead">
              pass one anonymous note a day to a stranger who is here at the
              same time.
            </p>
            <p class="intro__body">
              there is no server in the middle. two browsers find each other
              through a public relay, then talk straight to each other — the
              note never touches the relay, and nothing is kept anywhere but
              here.
            </p>
            <p class="intro__warn">
              the trade-off: to connect, your browser shares its ip address with
              the people in the room, the way any peer-to-peer app does.
            </p>
            <button
              class="go"
              onclick={goOnline}
              disabled={notes.status === "connecting"}
            >
              come back online
            </button>
            {#if notes.status === "error"}
              <p class="intro__err">{notes.error}</p>
            {/if}
          </div>
        {/if}

        <div class="inbox">
          <div class="inbox__head">
            <span class="inbox__title">notes that found you</span>
            <span class="inbox__count">{notes.inbox.length}</span>
          </div>
          {#if notes.inbox.length === 0}
            <p class="inbox__empty">
              nothing yet. a note may find you if someone is here when you are.
            </p>
          {:else}
            <ul class="inbox__list">
              {#each notes.inbox as n (n.id)}
                <li class="note">
                  <button
                    class="note__open"
                    onclick={() => (opened = n)}
                    aria-label="read this note"
                  >
                    <span class="note__body">{n.body}</span>
                  </button>
                  <div class="note__foot">
                    <span class="note__from" title={n.pubKey}
                      >from {shortKey(n.pubKey)}</span
                    >
                    <span class="note__day">{n.day}</span>
                    <button
                      class="note__block"
                      onclick={() => blockSender(n.pubKey)}>block</button
                    >
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        {#if notes.blocked.length}
          <div class="blocked">
            <p class="blocked__head">blocked · {notes.blocked.length}</p>
            <ul class="blocked__list">
              {#each notes.blocked as k (k)}
                <li class="blocked__row">
                  <span class="blocked__key">{shortKey(k)}</span>
                  <button class="blocked__undo" onclick={() => unblockSender(k)}
                    >unblock</button
                  >
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      <div class="modal__foot">
        {#if online}
          <button class="modal__away" onclick={goOffline}>step away</button>
        {/if}
        <span class="modal__spacer"></span>
        <span class="modal__count">{notes.inbox.length} kept</span>
        <button
          class="modal__clear"
          onclick={armClear}
          disabled={!notes.inbox.length}
        >
          {clearArmed ? "really? tap again" : "clear notes"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- one note, on its own: the same paper the compose view uses, read-only,
     with nothing around it but the note itself. click away or escape to
     go back. -->
{#if opened}
  <div
    class="focus"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) opened = null;
    }}
  >
    <div
      class="focus__note"
      role="dialog"
      aria-modal="true"
      aria-label="a sticky note"
      tabindex="-1"
      use:trapFocus
    >
      <StickyNote value={opened.body} label="a note from a stranger">
        {#snippet foot()}
          <span class="focus__from" title={opened.pubKey}
            >from {shortKey(opened.pubKey)}</span
          >
          <span class="focus__day">{opened.day}</span>
        {/snippet}
      </StickyNote>
      <button
        class="focus__x"
        onclick={() => (opened = null)}
        aria-label="close note">✕</button
      >
    </div>
  </div>
{/if}

<style>
  /* ============================================================
     the tab — a sticky note stuck to the right edge of the screen
     ============================================================ */

  .sn {
    position: fixed;
    right: 0;
    top: 50%;
    z-index: 40;
    width: 124px;
    height: 124px;
    margin-top: -62px;
    padding: 0;
    border: 0;
    background: linear-gradient(158deg, #fff7bd, #ffe27a 52%, #ffd24d);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 22px 40px -22px #000;
    /* most of the note is off-screen; only the slide moves, so it stays
       on the compositor */
    transform: translateX(70px) rotate(-4deg);
    transition: transform 0.34s cubic-bezier(0.2, 0.9, 0.3, 1.08);
    will-change: transform;
  }
  .sn:hover,
  .sn:focus-visible {
    transform: translateX(8px) rotate(-1deg);
  }
  .sn:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  /* the folded corner, on the visible edge */
  .sn__fold {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 24px;
    height: 24px;
    background: linear-gradient(45deg, #d9a92e, #f7dd8a);
    clip-path: polygon(0 0, 100% 100%, 0 100%);
    box-shadow: 2px -2px 6px -2px rgba(0, 0, 0, 0.45);
  }

  /* the one mark that is always on the sliver */
  .sn__mark {
    position: absolute;
    left: 0;
    top: 50%;
    width: 54px;
    translate: 0 -50%;
    text-align: center;
    font-size: 21px;
    line-height: 1;
    color: #4a3405;
    opacity: 0.85;
  }

  /* the label lives in the hidden half, so it arrives with the slide */
  .sn__label {
    position: absolute;
    right: 14px;
    top: 50%;
    width: 92px;
    translate: 0 -50%;
    text-align: right;
    font-family: var(--pixel);
    font-size: 19px;
    line-height: 1.05;
    letter-spacing: 0.04em;
    color: #4a3405;
  }

  .sn__badge {
    position: absolute;
    left: 5px;
    top: 5px;
    min-width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    padding: 0 4px;
    font-family: var(--pixel);
    font-size: 14px;
    line-height: 1;
    color: #fff;
    background: var(--magenta);
    border-radius: 9px;
    box-shadow: 0 0 10px -1px
      color-mix(in srgb, var(--magenta) 80%, transparent);
    animation: badge-pop 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.15);
  }
  @keyframes badge-pop {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }

  /* below the width where the rail would collide with it, the tab
     steps aside — the site map carries a "sticky notes" entry instead */
  @media (max-width: 1200px) {
    .sn {
      display: none;
    }
  }

  /* ============================================================
     the modal — a desk with one note to write and the notes that
     found you
     ============================================================ */

  .veil {
    position: fixed;
    inset: 0;
    z-index: 270;
    display: grid;
    place-items: center;
    padding: 20px;
    background: color-mix(in srgb, var(--bg) 62%, transparent);
    backdrop-filter: blur(2px);
    animation: fade 0.18s ease;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  .modal {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(520px, 100%);
    max-height: min(88vh, 780px);
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
    border: 1px solid var(--line-hot);
    border-radius: 6px;
    box-shadow:
      0 0 0 1px #000,
      0 0 80px -20px color-mix(in srgb, var(--gold) 45%, transparent),
      0 40px 80px -40px #000;
    animation: pop 0.26s cubic-bezier(0.2, 0.9, 0.3, 1.05);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
  }

  .modal__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  .modal__title {
    font-family: var(--pixel);
    font-size: 20px;
    line-height: 1;
    letter-spacing: 0.05em;
    color: var(--gold);
  }
  .modal__spacer {
    flex: 1;
  }
  .modal__tag {
    font-family: var(--pixel);
    font-size: 16px;
    color: var(--ink-faint);
    border: 1px solid var(--line-hot);
    border-radius: 3px;
    padding: 0 7px;
  }
  .modal__tag.on {
    color: var(--leaf);
  }
  .modal__x {
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
  .modal__x:hover {
    background: color-mix(in srgb, var(--orange) 30%, transparent);
  }

  .modal__body {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px 16px;
    scrollbar-width: thin;
  }

  .hint {
    margin: 0 0 12px;
    font-size: 11.5px;
    line-height: 1.7;
    color: var(--ink-dim);
  }

  /* ---------- the note you write ---------- */

  .desk {
    padding: 18px 6px 16px;
  }
  .pad__count {
    font-family: var(--mono);
    font-size: 10.5px;
    color: rgba(74, 52, 5, 0.6);
  }
  .pad__send {
    margin-left: auto;
    padding: 7px 15px;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffe27a;
    background: #4a3405;
    border: 0;
    border-radius: 3px;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
    transition:
      background 0.18s ease,
      transform 0.12s ease;
  }
  .pad__send:hover:not(:disabled) {
    background: #6b4d0a;
  }
  .pad__send:active:not(:disabled) {
    transform: translateY(1px);
  }
  .pad__send:disabled {
    opacity: 0.45;
    box-shadow: none;
  }

  .under {
    margin: 0 0 4px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--ink-dim);
  }
  .result {
    margin: 6px 0 0;
    font-size: 11px;
    color: var(--gold);
  }

  /* ---------- the offline intro ---------- */

  .intro {
    margin-bottom: 18px;
  }
  .intro__lead {
    margin: 0 0 10px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink);
  }
  .intro__body {
    margin: 0 0 10px;
    font-size: 11.5px;
    line-height: 1.75;
    color: var(--ink-dim);
  }
  .intro__warn {
    margin: 0 0 13px;
    font-size: 11px;
    line-height: 1.7;
    color: var(--gold);
  }
  .go {
    width: 100%;
    padding: 9px 12px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gold);
    background: color-mix(in srgb, var(--gold) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
    border-radius: 3px;
    transition:
      background 0.18s ease,
      box-shadow 0.18s ease;
  }
  .go:hover:not(:disabled) {
    background: color-mix(in srgb, var(--gold) 24%, transparent);
    box-shadow: 0 0 18px -3px color-mix(in srgb, var(--gold) 70%, transparent);
  }
  .go:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .intro__err {
    margin: 9px 0 0;
    font-size: 11px;
    color: var(--orange);
  }

  /* ---------- the notes that found you ---------- */

  .inbox {
    margin-top: 20px;
  }
  .inbox__head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
  }
  .inbox__title {
    font-family: var(--pixel);
    font-size: 17px;
    letter-spacing: 0.06em;
    color: var(--ink-dim);
  }
  .inbox__count {
    font-family: var(--pixel);
    font-size: 15px;
    color: var(--ink-faint);
  }
  .inbox__empty {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.7;
    color: var(--ink-faint);
  }
  .inbox__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .note {
    position: relative;
    padding: 14px 13px 10px;
    background: linear-gradient(158deg, #fff7bd, #ffe27a 55%, #ffd24d);
    border-radius: 2px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.6),
      0 12px 20px -14px rgba(0, 0, 0, 0.85);
    transform: rotate(-1deg);
  }
  .note:nth-child(2n) {
    transform: rotate(1.2deg);
  }
  .note:nth-child(3n) {
    transform: rotate(-1.8deg);
  }
  .note::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    width: 18px;
    height: 18px;
    background: linear-gradient(135deg, #f7dd8a, #d9a92e);
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
    box-shadow: -1px -1px 4px -1px rgba(0, 0, 0, 0.4);
  }
  .note__open {
    display: block;
    width: 100%;
    margin: 0 0 8px;
    padding: 0;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .note__open:hover .note__body {
    color: #000;
    text-decoration: underline dotted rgba(74, 52, 5, 0.5);
    text-underline-offset: 3px;
  }
  .note__open:focus-visible {
    outline: 2px solid #8a3b1e;
    outline-offset: 2px;
  }
  .note__body {
    display: block;
    font-family: var(--display);
    font-size: 13px;
    line-height: 1.5;
    color: #2c2417;
    word-break: break-word;
    white-space: pre-wrap;
  }
  .note__foot {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--mono);
    font-size: 9.5px;
    color: rgba(74, 52, 5, 0.62);
  }
  .note__from {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .note__day {
    flex: none;
  }
  .note__block {
    margin-left: auto;
    flex: none;
    padding: 2px 7px;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #8a3b1e;
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(74, 52, 5, 0.3);
    border-radius: 3px;
  }
  .note__block:hover {
    color: #fff;
    background: #8a3b1e;
    border-color: #8a3b1e;
  }

  /* ---------- one note, on its own ---------- */

  .focus {
    position: fixed;
    inset: 0;
    z-index: 280;
    display: grid;
    place-items: center;
    padding: 44px 20px;
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    backdrop-filter: blur(3px);
    animation: fade 0.18s ease;
  }
  .focus__note {
    width: min(340px, 86vw);
    animation: focus-in 0.22s ease;
  }
  /* fade only — a transform here would briefly become the containing
     block for the fixed close button and drag it off the corner */
  @keyframes focus-in {
    from {
      opacity: 0;
    }
  }
  .focus__from {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mono);
    font-size: 10px;
    color: rgba(74, 52, 5, 0.62);
  }
  .focus__day {
    margin-left: auto;
    flex: none;
    font-family: var(--mono);
    font-size: 10px;
    color: rgba(74, 52, 5, 0.5);
  }
  .focus__x {
    position: fixed;
    top: 18px;
    right: 20px;
    width: 30px;
    height: 28px;
    display: grid;
    place-items: center;
    font-size: 12px;
    color: var(--ink-faint);
    background: none;
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .focus__x:hover {
    color: var(--orange);
    border-color: color-mix(in srgb, var(--orange) 55%, transparent);
  }

  /* ---------- the block list ---------- */

  .blocked {
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .blocked__head {
    margin: 0 0 8px;
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }
  .blocked__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 5px;
  }
  .blocked__row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--ink-faint);
  }
  .blocked__key {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .blocked__undo {
    margin-left: auto;
    flex: none;
    padding: 2px 8px;
    font-family: var(--mono);
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
    background: none;
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .blocked__undo:hover {
    color: var(--leaf);
    border-color: color-mix(in srgb, var(--leaf) 55%, transparent);
  }

  /* ---------- the foot ---------- */

  .modal__foot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-top: 1px solid var(--line);
  }
  .modal__count {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--ink-faint);
  }
  .modal__away,
  .modal__clear {
    padding: 5px 10px;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: 3px;
  }
  .modal__away {
    color: var(--ink-faint);
    background: none;
    border: 1px solid var(--line);
  }
  .modal__away:hover {
    color: var(--orange);
    border-color: color-mix(in srgb, var(--orange) 55%, transparent);
  }
  .modal__clear {
    color: var(--ink-dim);
    background: none;
    border: 1px solid var(--line);
  }
  .modal__clear:hover:not(:disabled) {
    color: var(--orange);
    border-color: color-mix(in srgb, var(--orange) 55%, transparent);
  }
  .modal__clear:disabled {
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .sn,
    .sn__badge,
    .veil,
    .modal,
    .focus,
    .focus__note {
      transition: none;
      animation: none;
    }
  }
</style>
