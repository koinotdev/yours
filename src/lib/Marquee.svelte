<script>
  let { items = [], speed = 34 } = $props();
</script>

<div class="marquee" role="marquee" aria-label="announcements">
  <!-- two identical tracks, each holding ONE copy of the list, side by
       side. both slide left by their own width; when the first has left
       the stage the second sits exactly where it began, so the loop is
       seamless. keeping each track to a single copy halves the width of
       the composited layer — the old single track held two copies and
       was wide enough (~4.4k css px, ~8.9k device px at 2x) that the
       compositor re-rasterised it every frame instead of just moving a
       texture, which is what made the ticker so expensive. -->
  {#each [0, 1] as copy (copy)}
    <div
      class="marquee__track"
      style="animation-duration:{speed}s"
      aria-hidden={copy === 1 ? "true" : undefined}
    >
      {#each items as item}
        <span class="marquee__item">
          <span class="marquee__star">✦</span>{item}
        </span>
      {/each}
    </div>
  {/each}
</div>

<style>
  .marquee {
    position: relative;
    z-index: 1;
    display: flex;
    overflow: hidden;
    /* isolate the ticker so the compositor can move it without
       repainting the rest of the page */
    contain: paint;
    border-block: 1px solid var(--line);
    /* opaque base: the edge fades below blend against this, so no
       mask is needed */
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--leaf) 6%, transparent),
        color-mix(in srgb, var(--gold) 6%, transparent)
      ),
      var(--bg-2);
    padding-block: 9px;
    white-space: nowrap;
  }

  /* the edge fade used to be a mask-image on .marquee. a mask on the
     parent of an animating child stops Firefox from compositing the
     transform, so the whole ticker repainted every frame. two opaque
     gradient overlays give the same look and let the track ride the
     compositor instead. */
  .marquee::before,
  .marquee::after {
    content: "";
    position: absolute;
    inset-block: 0;
    width: 6%;
    pointer-events: none;
    z-index: 1;
  }
  .marquee::before {
    left: 0;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--bg-2) 94%, var(--leaf)),
      transparent
    );
  }
  .marquee::after {
    right: 0;
    background: linear-gradient(
      270deg,
      color-mix(in srgb, var(--bg-2) 94%, var(--gold)),
      transparent
    );
  }

  .marquee__track {
    flex: none;
    display: inline-flex;
    gap: 42px;
    padding-left: 42px;
    animation: slide linear infinite;
    will-change: transform;
    backface-visibility: hidden;
  }

  .marquee__item {
    font-family: var(--pixel);
    font-size: 21px;
    letter-spacing: 0.05em;
    color: var(--ink-dim);
    text-transform: lowercase;
  }
  .marquee__star {
    color: var(--gold);
    margin-right: 10px;
    text-shadow: var(--glow-gold);
  }

  @keyframes slide {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(-100%, 0, 0);
    }
  }
</style>
