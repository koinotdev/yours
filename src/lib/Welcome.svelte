<script>
  import { config } from "./config.svelte.js";
  import { windowState } from "./windows.svelte.js";
  import WinBtns from "./WinBtns.svelte";

  let { onSettings, away = null } = $props();

  // a warm nod to how long you have been gone. the cat is the one who
  // notices.
  function backLine(days) {
    if (days === 1) return "you were here yesterday. the cat noticed.";
    if (days < 7) return `it's been ${days} days. the cat kept your seat warm.`;
    if (days < 30)
      return `it's been ${days} days. the plants are fine. the cat missed you.`;
    if (days < 365)
      return `it's been ${days} days. nothing here moved. it waited.`;
    return "it has been more than a year. the sun kept rising anyway. welcome back.";
  }
</script>

<section
  class="panel"
  id="welcome"
  class:min={windowState("welcome") === "min"}
>
  <div class="panel__bar">
    <span class="panel__title">welcome.txt</span>
    <WinBtns id="welcome" />
  </div>

  <div class="panel__body">
    {#if away}
      <p class="back">
        <span class="back__mark" aria-hidden="true">❧</span>{backLine(away)}
      </p>
    {/if}

    <h2 class="hello">{config.welcome.heading}</h2>
    <p class="note">{config.welcome.body}</p>

    <button class="btn btn--gold" onclick={onSettings}
      >⚙ make this place yours</button
    >
  </div>
</section>

<style>
  .back {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 14px;
    padding: 7px 11px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--ink-dim);
    background: color-mix(in srgb, var(--leaf) 7%, transparent);
    border-left: 2px solid color-mix(in srgb, var(--leaf) 55%, transparent);
    border-radius: 0 3px 3px 0;
  }
  .back__mark {
    color: var(--leaf);
    text-shadow: var(--glow-lime);
  }

  .hello {
    margin: 0 0 12px;
    font-family: var(--display);
    font-weight: 700;
    font-size: clamp(24px, 4.5vw, 38px);
    line-height: 1.05;
    letter-spacing: -0.03em;
    background: linear-gradient(100deg, var(--lime), var(--leaf), var(--cyan));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(
      0 0 22px color-mix(in srgb, var(--leaf) 26%, transparent)
    );
  }

  .note {
    max-width: 68ch;
    margin: 0 0 18px;
    white-space: pre-wrap;
    font-size: clamp(12.5px, 1.5vw, 14.5px);
    line-height: 1.75;
    color: var(--ink-dim);
  }
</style>
