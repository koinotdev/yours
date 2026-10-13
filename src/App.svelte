<script>
  import { onMount } from "svelte";
  import BootScreen from "./lib/BootScreen.svelte";
  import TopBar from "./lib/TopBar.svelte";
  import Masthead from "./lib/Masthead.svelte";
  import Marquee from "./lib/Marquee.svelte";
  import Sidebar from "./lib/Sidebar.svelte";
  import News from "./lib/News.svelte";
  import WildEncounter from "./lib/WildEncounter.svelte";
  import Pokedex from "./lib/Pokedex.svelte";
  import Doodle from "./lib/Doodle.svelte";
  import Trivia from "./lib/Trivia.svelte";
  import Fingerprint from "./lib/Fingerprint.svelte";
  import Footer from "./lib/Footer.svelte";
  import Cat from "./lib/Cat.svelte";
  import Cassette from "./lib/Cassette.svelte";
  import Welcome from "./lib/Welcome.svelte";
  import Settings from "./lib/Settings.svelte";
  import SecretGame from "./lib/SecretGame.svelte";
  import Synth from "./lib/Synth.svelte";
  import Notebook from "./lib/Notebook.svelte";
  import StickyNotes from "./lib/StickyNotes.svelte";
  import NoteToast from "./lib/NoteToast.svelte";
  import TrophyToast from "./lib/TrophyToast.svelte";
  import { onSecret, onSynth, watchKonami, watchSynth } from "./lib/secret.js";
  import { config, persist, adoptGuestConfig } from "./lib/config.svelte.js";
  import {
    isGuest,
    leaveGuest,
    importOptIn,
    shareReady,
  } from "./lib/share.svelte.js";
  import { applyTheme } from "./lib/theme.js";
  import { tod, startTimeOfDay } from "./lib/timeofday.svelte.js";
  import { loadTape, loadSound, playTape } from "./lib/tape.js";
  import { unlock } from "./lib/achievements.svelte.js";
  import { windowState } from "./lib/windows.svelte.js";
  import { sortable } from "./lib/drag.js";

  let booted = $state(false);
  let gameOpen = $state(false);
  let settingsOpen = $state(false);
  let dexOpen = $state(false);
  let notesOpen = $state(false);
  let stickiesOpen = $state(false);
  let view = $state("home"); // 'home' | 'synth'

  // how long you have been away. recorded here, at the root, so it counts
  // a visit even if the welcome window happens to be closed. it is not
  // part of the config. it is about you.
  const SEEN_KEY = "yours.seen";
  const DAY = 86400000;
  let away = $state(null);

  function readSeen() {
    try {
      const prev = Number(localStorage.getItem(SEEN_KEY));
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      if (!Number.isFinite(prev) || prev <= 0) return null;
      const days = Math.floor((Date.now() - prev) / DAY);
      return days >= 1 ? days : null;
    } catch {
      return null;
    }
  }

  // the config is the page — mirror the parts of it the browser owns
  $effect(() => {
    document.title = `${config.identity.title} ~ home`;
  });
  $effect(() => applyTheme(config.theme));
  // the light follows the clock, unless the config turns it off. the
  // phase is a data attribute on <html>, so app.css can pick the wash.
  $effect(() => {
    const root = document.documentElement;
    if (config.lighting) root.dataset.tod = tod.phase;
    else delete root.dataset.tod;
  });
  // taking the snapshot here is what subscribes this effect to every
  // field; persist() only debounces the write
  $effect(() => persist(JSON.stringify(config)));

  // the only hash this page ever keeps is #synth — the synth is a real
  // address you can reload or share. section links scroll without
  // touching the url (see scroll.js), so a reload starts at the top.
  const cleanURL = () => location.pathname + location.search;

  // the synth is a page with its own address
  function showSynth() {
    if (view === "synth") return;
    notesOpen = false;
    view = "synth";
    unlock("synth-finder");
    window.scrollTo({ top: 0 });
    if (location.hash !== "#synth")
      history.pushState({ synth: true }, "", "#synth");
  }

  // the game is reachable three ways, so the trophy is earned by the
  // opening rather than by any one trigger
  function openGame() {
    gameOpen = true;
    unlock("vine-diver");
  }

  // a note that arrives while you are on the synth page should still
  // reach you: come home and open the drawer
  function openStickies() {
    if (view === "synth") hideSynth();
    stickiesOpen = true;
  }

  function hideSynth() {
    view = "home";
    if (location.hash !== "#synth") return;
    if (history.state?.synth) history.back();
    else history.replaceState(null, "", cleanURL());
  }

  function syncView() {
    view = location.hash === "#synth" ? "synth" : "home";
  }

  // the brand link: leave the synth if we are on it, otherwise glide
  // back to the top of the page
  function goHome() {
    if (view === "synth") hideSynth();
    else window.scrollTo({ top: 0 });
  }

  // an old bookmark to a section (#welcome, say) is quietly dropped, so
  // the address bar stays clean and the next reload starts at the top.
  // a share link is the one other hash we keep — it is the room itself.
  function dropStrayHash() {
    const h = location.hash;
    if (h && h !== "#synth" && !h.startsWith("#share=")) {
      history.replaceState(null, "", cleanURL());
    }
  }

  // leaving a shared room: drop the fragment too, so a reload does not
  // walk back into it
  function clearShareHash() {
    if (location.hash.startsWith("#share=")) {
      history.replaceState(null, "", cleanURL());
    }
  }

  // "make it mine": keep the guest's config and the opt-in stores, then
  // step out of guest mode so they become the visitor's own
  function makeItMine() {
    adoptGuestConfig();
    importOptIn();
    leaveGuest();
    clearShareHash();
  }

  // "go home": back to the visitor's own room, untouched
  function goHomeGuest() {
    leaveGuest();
    clearShareHash();
  }

  // the arrival greeting: play the tape on the first gesture that the
  // browser will actually accept. it stays armed until the sound really
  // starts, so a gesture the browser ignores just means we try the next
  // one — and the boot screen's skip is a gesture.
  let greeted = false;
  let greeting = false;
  let disarm = () => {};
  async function greet() {
    // the guard is set before the await: one Enter press fires both a
    // keydown and a click, and both would otherwise start the tape
    if (greeted || greeting) return;
    const events = loadTape();
    if (!events.length) {
      greeted = true;
      disarm();
      return;
    }
    greeting = true;
    try {
      if (await playTape(events, loadSound())) {
        greeted = true;
        disarm();
      }
    } finally {
      greeting = false;
    }
  }

  // the browser likes to put you back where you were on reload and on
  // back / forward. this page would rather you always land at the top,
  // so hand scroll restoration to us and pin it on every entry.
  function toTop() {
    window.scrollTo(0, 0);
  }

  onMount(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    toTop();
    dropStrayHash();
    syncView();
    away = readSeen();
    // the small hours count as a visit too — but only for the visitor's
    // own room, so wait until we know whether this is a guest link before
    // handing out the trophy
    shareReady.then(() => {
      if (new Date().getHours() < 5) unlock("night-owl");
    });

    const stopTod = startTimeOfDay();

    const offSecret = onSecret(openGame);
    const offKonami = watchKonami(() => {
      unlock("konami");
      openGame();
    });
    const offSynth = onSynth(showSynth);
    const offType = watchSynth(showSynth);
    window.addEventListener("hashchange", syncView);
    window.addEventListener("popstate", syncView);
    // a bfcache restore (back / forward) replays the frozen page with its
    // old scroll offset, so pin it again when that happens
    const onPageShow = (e) => {
      if (e.persisted) toTop();
    };
    window.addEventListener("pageshow", onPageShow);

    // arm the greeting unless we opened straight into the synth, where
    // the first keypress is meant to play a note, so the tape stays out
    // of the way.
    // it listens for the same gestures the boot screen accepts, so the
    // tape plays exactly as you enter rather than on a stray keypress.
    if (config.arrival.play && location.hash !== "#synth") {
      const arm = (e) => {
        if (e.type === "keydown") {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          if (e.key !== " " && e.key !== "Enter") return;
        }
        greet();
      };
      disarm = () => {
        window.removeEventListener("click", arm);
        window.removeEventListener("keydown", arm);
      };
      window.addEventListener("click", arm);
      window.addEventListener("keydown", arm);
    }

    return () => {
      offSecret();
      offKonami();
      offSynth();
      offType();
      disarm();
      stopTod();
      window.removeEventListener("hashchange", syncView);
      window.removeEventListener("popstate", syncView);
      window.removeEventListener("pageshow", onPageShow);
    };
  });
</script>

{#if !booted}
  <BootScreen
    onDone={() => {
      booted = true;
      unlock("first-light");
    }}
  />
{/if}

<div class="fx" aria-hidden="true"></div>
<div class="tod" aria-hidden="true"></div>

<Cat />

<!-- the cassette deck: the visitor's own music, docked bottom-left. it
     publishes --deck-h so the trophy toasts stack above it. -->
{#if view === "home"}
  <Cassette />
{/if}

<TrophyToast />

<TopBar onSettings={() => (settingsOpen = true)} onHome={goHome} />

{#if isGuest()}
  <div class="guestbar" role="status">
    <span class="guestbar__text">
      you're visiting <b>{config.identity.name}</b>'s room — read only
    </span>
    <button class="btn guestbar__btn" onclick={makeItMine}>make it mine</button>
    <button class="btn btn--ghost guestbar__btn" onclick={goHomeGuest}
      >go home</button
    >
  </div>
{/if}

{#if view === "synth"}
  <Synth onExit={hideSynth} />
{:else}
  <div class="wrap">
    <Masthead />
  </div>

  {#if config.marquee.length}
    <Marquee items={config.marquee} />
  {/if}

  <div class="wrap layout">
    <Sidebar
      onSettings={() => (settingsOpen = true)}
      onNotes={() => (notesOpen = true)}
      onStickies={openStickies}
    />

    <main class="main" use:sortable>
      {#each config.order as id (id)}
        {#if windowState(id) !== "closed"}
          {#if id === "welcome"}
            <Welcome {away} onSettings={() => (settingsOpen = true)} />
          {:else if id === "news"}
            <News />
          {:else if id === "encounter"}
            <WildEncounter onOpenDex={() => (dexOpen = true)} />
          {:else if id === "doodle"}
            <Doodle />
          {:else if id === "trivia"}
            <Trivia />
          {:else if id === "fingerprint"}
            <Fingerprint />
          {/if}
        {/if}
      {/each}
    </main>
  </div>

  <Notebook
    open={notesOpen}
    onOpen={() => (notesOpen = true)}
    onClose={() => (notesOpen = false)}
  />

  <StickyNotes
    open={stickiesOpen}
    onOpen={openStickies}
    onClose={() => (stickiesOpen = false)}
  />
{/if}

<NoteToast onOpen={openStickies} />

<Footer />

{#if dexOpen}
  <Pokedex onClose={() => (dexOpen = false)} />
{/if}

{#if settingsOpen}
  <Settings onClose={() => (settingsOpen = false)} />
{/if}

{#if gameOpen}
  <SecretGame onClose={() => (gameOpen = false)} />
{/if}

<style>
  /* the guest banner: pinned just under the top bar, so it is always
     in view while you are in someone else's room */
  .guestbar {
    position: sticky;
    top: 52px;
    z-index: 49;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    font-size: 12px;
    color: var(--ink);
    background: color-mix(in srgb, var(--gold) 12%, var(--bg));
    border-bottom: 1px solid color-mix(in srgb, var(--gold) 40%, transparent);
  }
  .guestbar__text {
    flex: 1 1 220px;
  }
  .guestbar__text b {
    color: var(--gold);
  }
  .guestbar__btn {
    padding: 5px 11px;
    font-size: 11px;
  }
</style>
