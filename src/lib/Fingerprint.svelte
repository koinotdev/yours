<script>
  import { onMount } from "svelte";
  import { windowState } from "./windows.svelte.js";
  import WinBtns from "./WinBtns.svelte";

  // Everything here is read straight off the browser, with no prompt and
  // no request. Each line is dull on its own; together they are a
  // fingerprint. So the window shows the lines, then the id they add up
  // to, then says plainly that none of it went anywhere. Nothing is
  // stored; the id is recomputed each visit.

  const n = navigator;
  const s = screen;
  const mm = (q) => matchMedia(q).matches;
  const yn = (b) => (b ? "yes" : "no");

  // the rendering engine, guessed from the ua string — the one line that
  // says which family of bugs you live with
  function engine(ua) {
    if (/firefox|fxios/i.test(ua)) return "gecko";
    if (/edg\/|chrome|crios|opr\//i.test(ua)) return "blink";
    if (/safari/i.test(ua)) return "webkit";
    return "unknown";
  }

  // a row that quietly drops itself when the browser has nothing to say,
  // so an unsupported signal is absent rather than a sad "n/a"
  const row = (k, v, note) =>
    v === undefined || v === null || v === ""
      ? null
      : { k, v: String(v), note };

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const loc = n.language;
  const hour12 =
    Intl.DateTimeFormat().resolvedOptions().hourCycle?.startsWith("h1") ??
    false;

  const nav = performance.getEntriesByType("navigation")[0];
  const arrival =
    {
      navigate: "you typed it in",
      reload: "you reloaded",
      back_forward: "you came back",
    }[nav?.type] ?? "you arrived";
  const loadMs =
    nav && nav.loadEventEnd > 0
      ? Math.round(nav.loadEventEnd - nav.startTime)
      : null;

  // storage.estimate() is async, so this one row fills in a beat later
  let quota = $state(null);

  const groups = $derived(
    [
      {
        head: "the machine",
        rows: [
          row(
            "cores",
            n.hardwareConcurrency,
            "how many things you can do at once",
          ),
          row(
            "memory",
            n.deviceMemory && `${n.deviceMemory} gb`,
            "rounded to a power of two",
          ),
          row("platform", n.platform, "your system, in one word"),
          row(
            "touch",
            n.maxTouchPoints && `${n.maxTouchPoints} points`,
            "how many fingers it expects",
          ),
        ].filter(Boolean),
      },
      {
        head: "the display",
        rows: [
          row(
            "screen",
            `${s.width} × ${s.height}`,
            "a strong hint all on its own",
          ),
          row("window", `${innerWidth} × ${innerHeight}`),
          row("pixel ratio", devicePixelRatio, "how sharp it is"),
          row("colour", `${s.colorDepth}-bit`),
          row("hdr", yn(mm("(dynamic-range: high)"))),
          row("wide gamut", yn(mm("(color-gamut: p3)"))),
        ].filter(Boolean),
      },
      {
        head: "the clock",
        rows: [
          row("timezone", tz, "narrows you to a band of the map"),
          row("locale", loc),
          row("clock", hour12 ? "12-hour" : "24-hour"),
        ].filter(Boolean),
      },
      {
        head: "the tells",
        rows: [
          row(
            "colour scheme",
            mm("(prefers-color-scheme: dark)") ? "dark" : "light",
          ),
          row(
            "motion",
            mm("(prefers-reduced-motion: reduce)") ? "reduced" : "full",
          ),
          row("contrast", mm("(prefers-contrast: more)") ? "more" : "normal"),
        ].filter(Boolean),
      },
      {
        head: "the wire",
        rows: [
          row("online", yn(n.onLine)),
          row(
            "connection",
            n.connection?.effectiveType,
            "the shape of your link",
          ),
          row(
            "storage",
            quota && `${quota} gb free`,
            "what this page may keep",
          ),
        ].filter(Boolean),
      },
      {
        head: "the browser",
        rows: [
          row("engine", engine(n.userAgent)),
          row("secure", yn(isSecureContext), "served over https"),
          row(
            "do not track",
            n.doNotTrack === "1"
              ? "on"
              : n.doNotTrack === "0"
                ? "off"
                : "unset",
          ),
          row(
            "global privacy control",
            n.globalPrivacyControl ? "on" : "unset",
          ),
        ].filter(Boolean),
      },
      {
        head: "the visit",
        rows: [
          row("arrival", arrival, "how you got here"),
          row("load", loadMs && `${loadMs} ms`, "how long the page took"),
          row("history", history.length, "how deep your tab goes"),
        ].filter(Boolean),
      },
    ].filter((g) => g.rows.length),
  );

  // the id a tracker would keep. built from the stable signals only — the
  // live ones (online, storage) would make it wobble. fnv-1a is enough:
  // a fingerprint only needs to be stable.
  const signals = [
    n.hardwareConcurrency,
    n.deviceMemory,
    n.platform,
    `${s.width}x${s.height}`,
    devicePixelRatio,
    s.colorDepth,
    tz,
    loc,
    engine(n.userAgent),
    n.maxTouchPoints,
    mm("(dynamic-range: high)"),
    mm("(color-gamut: p3)"),
    mm("(prefers-color-scheme: dark)"),
    mm("(prefers-reduced-motion: reduce)"),
    mm("(prefers-contrast: more)"),
  ].join("|");

  function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  const id = `${fnv(signals)}${fnv(signals + "·")}`
    .replace(/(.{4})/g, "$1 ")
    .trim();

  onMount(async () => {
    try {
      const est = await n.storage?.estimate?.();
      if (est?.quota) quota = Math.round(est.quota / 1e9);
    } catch {
      /* no estimate, no row — the list simply comes up one line shorter */
    }
  });
</script>

<section
  class="panel"
  id="fingerprint"
  class:min={windowState("fingerprint") === "min"}
>
  <div class="panel__bar">
    <span class="panel__title">fingerprint.txt</span>
    <WinBtns id="fingerprint" />
  </div>

  <div class="panel__body">
    <p class="fp__lede">
      your browser handed all of this over without being asked. together these
      lines name you, and a tracker would keep them to know you next time.
    </p>

    <div class="fp__id">
      <span class="fp__id-label">your id, as a tracker would keep it</span>
      <code class="fp__id-code">{id}</code>
    </div>

    <div class="fp__groups">
      {#each groups as g (g.head)}
        <div class="fp__group">
          <p class="fp__head">{g.head}</p>
          <ul class="fp__list">
            {#each g.rows as r (r.k)}
              <li class="fp__row">
                <span class="fp__k">{r.k}</span>
                <span class="fp__dots" aria-hidden="true"></span>
                <span class="fp__v">{r.v}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>

    <p class="fp__note">
      none of it left this tab. no request was made, no cookie was set, and
      there is no server here to receive it — the id above was computed in your
      own browser, and is forgotten the moment you close the page.
    </p>
  </div>
</section>

<style>
  .fp__lede {
    margin: 0 0 14px;
    max-width: 62ch;
    font-size: 12.5px;
    line-height: 1.7;
    color: var(--ink-dim);
  }

  .fp__id {
    display: grid;
    gap: 3px;
    margin-bottom: 18px;
    padding: 10px 12px;
    border: 1px dashed var(--line-hot);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--cyan) 3%, transparent);
  }
  .fp__id-label {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .fp__id-code {
    font-family: var(--pixel);
    font-size: clamp(22px, 4vw, 28px);
    letter-spacing: 0.1em;
    color: var(--cyan);
    text-shadow: var(--glow-cyan);
  }

  .fp__groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px 24px;
  }

  .fp__head {
    margin: 0 0 6px;
    font-family: var(--pixel);
    font-size: 16px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--leaf);
    text-shadow: 0 0 6px color-mix(in srgb, var(--leaf) 45%, transparent);
  }

  .fp__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 3px;
  }
  .fp__row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    font-size: 11.5px;
  }
  .fp__k {
    color: var(--ink-faint);
    white-space: nowrap;
  }
  /* the dotted leader of a table of contents, which is exactly what this is */
  .fp__dots {
    flex: 1;
    min-width: 10px;
    border-bottom: 1px dotted var(--line-hot);
    translate: 0 -3px;
  }
  .fp__v {
    color: var(--ink);
    font-weight: 700;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .fp__note {
    margin: 18px 0 0;
    padding: 10px 12px;
    font-size: 11.5px;
    line-height: 1.7;
    color: var(--ink-dim);
    border-left: 2px solid var(--leaf);
    border-radius: 0 var(--radius) var(--radius) 0;
    background: color-mix(in srgb, var(--leaf) 4%, transparent);
  }
</style>
