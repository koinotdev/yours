<script>
  import { onMount } from "svelte";
  import { appWeight } from "virtual:weight";
  import { measureVisit } from "./weight.js";
  import { unlock } from "./achievements.svelte.js";

  // in dev the build-time token is never substituted, so this is NaN and
  // the badge leans on the live measurement instead
  const built = Number(appWeight) || 0;

  let visit = $state(null);
  let open = $state(false);

  // decimal kB (÷1000) to match the build-time plugin and vite's own report
  const kb = (n) => (n / 1000).toFixed(1);

  onMount(() => {
    const read = () => (visit = measureVisit());
    read();

    if (typeof PerformanceObserver === "undefined") return;
    // fonts land after first paint, so keep re-reading as they arrive
    const po = new PerformanceObserver(read);
    po.observe({ type: "resource", buffered: true });
    const settle = setTimeout(read, 3000);

    return () => {
      po.disconnect();
      clearTimeout(settle);
    };
  });

  const measured = $derived(visit?.total ?? 0);
  const shown = $derived(measured || built);
  const live = $derived(measured > 0);

  const rows = $derived(
    visit
      ? [
          ["html", visit.buckets.html],
          ["css", visit.buckets.css],
          ["js", visit.buckets.js],
          ["fonts", visit.buckets.fonts],
          ["other", visit.buckets.other],
        ].filter(([, bytes]) => bytes > 0)
      : [],
  );
</script>

<div class="weight">
  <button
    class="badge"
    onclick={() => {
      open = !open;
      if (open) unlock("weight-watcher");
    }}
    aria-expanded={open}
    title="how much this page weighs"
  >
    <span class="badge__a">{shown ? `${kb(shown)} kb` : "—"}</span>
    <span class="badge__b">{live ? "this visit" : "app bundle"}</span>
  </button>

  {#if open}
    <div class="detail">
      <p class="detail__head">
        {live ? "measured on this visit" : "build-time bundle"}
      </p>

      <ul class="detail__list">
        {#each rows as [label, bytes]}
          <li><span>{label}</span><b>{kb(bytes)} kb</b></li>
        {/each}
        {#if !live}
          <li><span>app bundle</span><b>{kb(built)} kb</b></li>
        {/if}
      </ul>

      <p class="detail__note">
        gzipped, over the wire. the fonts are self-hosted, so they are
        same-origin and always counted here. a cached reload reads lighter.
      </p>
    </div>
  {/if}
</div>

<style>
  .weight {
    margin-top: 18px;
  }

  .badge {
    width: 88px;
    height: 31px;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 1px;
    padding: 2px;
    text-align: center;
    line-height: 1;
    border: 1px solid color-mix(in srgb, var(--leaf) 70%, #000);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--leaf) 90%, #fff 10%),
      var(--leaf)
    );
    color: var(--on-accent);
    box-shadow:
      0 0 0 1px #000,
      0 4px 14px -6px color-mix(in srgb, var(--leaf) 80%, transparent);
    transition:
      transform 0.12s ease,
      filter 0.2s ease;
    overflow: hidden;
  }
  .badge:hover {
    transform: translateY(-3px) rotate(-1.5deg);
    filter: brightness(1.12);
  }
  .badge__a {
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.04em;
  }
  .badge__b {
    font-family: var(--mono);
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .detail {
    margin-top: 12px;
    padding: 12px 14px;
    border: 1px dashed var(--line-hot);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--leaf) 3%, transparent);
  }
  .detail__head {
    margin: 0 0 8px;
    font-family: var(--pixel);
    font-size: 17px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--leaf);
  }
  .detail__list {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: grid;
    gap: 4px;
    font-size: 11.5px;
  }
  .detail__list li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--ink-faint);
  }
  .detail__list b {
    color: var(--ink-dim);
    font-weight: 700;
  }
  .detail__note {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.6;
    color: var(--ink-faint);
  }
</style>
