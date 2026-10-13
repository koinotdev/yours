<script>
  import { windowState } from "./windows.svelte.js";
  import WinBtns from "./WinBtns.svelte";

  const news = [
    {
      when: "2026-10-02",
      what: "the room follows your clock now — dawn, day, dusk and night each wash it in a different light, mixed from your palette. turn it off in settings.cfg.",
    },
    {
      when: "2026-10-02",
      what: "there is a doodle.dat now — a small pad you can draw on. it keeps your drawing in this browser, and you can save it as a png.",
    },
    {
      when: "2026-10-02",
      what: "the wild encounter is a guessing game now — name the silhouette before you peek. a right guess grows a streak, a wrong one starts it over.",
    },
    {
      when: "2026-10-02",
      what: "there is a pokedex.dat now — every pokemon you meet is recorded, filterable by generation, and it marks the ones you have caught and the shinies. it fills one encounter a day.",
    },
    {
      when: "2026-09-30",
      what: "trivia.dat keeps a day streak now — get one right and the day counts, come back tomorrow and it grows. miss a day and it starts over.",
    },
    {
      when: "2026-09-29",
      what: "there are sticky notes now — pass one anonymous note a day to a stranger who is here at the same time. it goes browser to browser, and no server keeps it.",
    },
    {
      when: "2026-10-13",
      what: "the cassette deck plays your own music now — paste a youtube link and it is yours. nothing loads until you press play, so the page still asks nothing of anyone who does not.",
    },
    {
      when: "2026-09-28",
      what: "guestbook.txt and readme.txt are gone — they looked the part but did nothing you could keep. whats_new.txt now sits at the bottom.",
    },
    {
      when: "2026-09-28",
      what: "there is a trivia.dat now — one question at a time, multiple choice or true/false, and it tells you when you are right.",
    },
    {
      when: "2026-09-26",
      what: "meeting a legendary, a mythical, or a baby now lights a trophy of its own.",
    },
    {
      when: "2026-09-26",
      what: "you can rename your pokemon now — click a name in your party and type.",
    },
    {
      when: "2026-09-26",
      what: "there is a fingerprint.txt now — it shows what a tracker could learn about you, and then says plainly that none of it left the tab.",
    },
    {
      when: "2026-09-25",
      what: "a trophy you already have no longer announces itself again every time you come in.",
    },
    {
      when: "2026-09-25",
      what: "the notebook can seal a page now — write something, seal it, and it stays hidden until the day you pick.",
    },
    {
      when: "2026-09-25",
      what: "come back after a while and welcome.txt will say how long it has been. no streaks, no guilt — just the cat noticing.",
    },
    {
      when: "2026-09-25",
      what: "your party is open by default now — no need to unfold it to see who is with you.",
    },
    {
      when: "2026-09-25",
      what: "you can move the sections now — take a window by its title bar and drag it up or down. the site map follows.",
    },
    {
      when: "2026-09-25",
      what: "the _ □ ✕ on every window work now. reduce one to its bar, close it, and bring it back from settings.cfg.",
    },
    {
      when: "2026-09-25",
      what: "there is a trophy cabinet now. a shelf in the left rail, and a window of things to find.",
    },
    {
      when: "2026-09-25",
      what: "the boot screen waits for you now — press space, enter, or click to come in.",
    },
    {
      when: "2026-09-25",
      what: "you can greet yourself now — turn on the arrival switch and your tape plays as you come in.",
    },
    {
      when: "2026-09-25",
      what: "the synth has a tape now. play something, hit rec, and it plays it back.",
    },
    {
      when: "2026-09-25",
      what: "the wild encounter is harder to fake now — it is re-derived from a seed, and your party is signed.",
    },
    {
      when: "2026-09-25",
      what: "the wild encounter is one a day now, with a 1-in-4096 shiny. what you meet can join a party of six.",
    },
    {
      when: "2026-09-25",
      what: "a notebook now peeks out from the left edge. it is yours, and it stays in this browser.",
    },
    {
      when: "2026-09-24",
      what: "the page is yours now. open settings.cfg and change the words, the colours, the lot.",
    },
    {
      when: "2026-09-24",
      what: "it stopped being a portfolio. now you can just stay a while.",
    },
    {
      when: "2026-09-24",
      what: "built a tiny synth. it is hidden — the ♪ in the footer knows the way.",
    },
    {
      when: "2026-09-24",
      what: "a cat now patrols the bottom of the page. it knows things.",
    },
    {
      when: "2026-09-20",
      what: "added a wild encounter. one click, one small request, one pokemon.",
    },
    {
      when: "2026-09-12",
      what: "self-hosted the fonts. zero third-party requests now.",
    },
    {
      when: "2026-08-30",
      what: "added the page-weight badge. it is honest about itself.",
    },
    {
      when: "2026-08-14",
      what: "rebuilt the layout as a proper old-school frameset.",
    },
    { when: "2026-07-02", what: "something is hidden here. three ways in." },
  ];
</script>

<section class="panel" id="news" class:min={windowState("news") === "min"}>
  <div class="panel__bar">
    <span class="panel__title">whats_new.txt</span>
    <WinBtns id="news" />
  </div>
  <div class="panel__body">
    <ul class="news">
      {#each news as n}
        <li><time datetime={n.when}>{n.when}</time><span>{n.what}</span></li>
      {/each}
    </ul>
  </div>
</section>
