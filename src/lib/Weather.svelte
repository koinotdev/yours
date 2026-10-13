<script>
  import { onMount } from "svelte";
  import { unlock } from "./achievements.svelte.js";

  // ── a small weather bug, parked next to the title ────────────────
  //
  // Open-Meteo, because it asks for no key, no account and no signup:
  // one GET, well under a kilobyte back. Nothing happens until the
  // thing is clicked — including the location request — so the
  // browser's permission prompt only ever appears because a person
  // asked for it, and never on load.
  //
  // The reading, and the rounded coordinates behind it, are kept in
  // localStorage. If a place is already set, the sky is read again on
  // arrival — quietly, with the cached reading still on screen — so the
  // number is fresh without a wait. With no place set, nothing happens
  // until you click, so the permission prompt never appears on its own.
  // Coordinates are stored at two decimals (~1 km) — plenty for weather,
  // and less to remember about you. Nothing here is sent anywhere but
  // open-meteo.
  // ─────────────────────────────────────────────────────────────────

  const FORECAST = "https://api.open-meteo.com/v1/forecast";
  const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
  const KEY = "yours.weather";
  const TTL = 30 * 60 * 1000; // a reading is good for half an hour

  // wmo weather codes → [word, glyph, accent]
  const WMO = {
    0: ["clear sky", "☀", "var(--gold)"],
    1: ["mostly clear", "☀", "var(--gold)"],
    2: ["partly cloudy", "◐", "var(--lime)"],
    3: ["overcast", "☁", "var(--ink-dim)"],
    45: ["fog", "≡", "var(--ink-dim)"],
    48: ["freezing fog", "≡", "var(--cyan)"],
    51: ["light drizzle", "☂", "var(--cyan)"],
    53: ["drizzle", "☂", "var(--cyan)"],
    55: ["heavy drizzle", "☂", "var(--cyan)"],
    56: ["freezing drizzle", "☂", "var(--cyan)"],
    57: ["freezing drizzle", "☂", "var(--cyan)"],
    61: ["light rain", "☂", "var(--cyan)"],
    63: ["rain", "☂", "var(--cyan)"],
    65: ["heavy rain", "☂", "var(--cyan)"],
    66: ["freezing rain", "☂", "var(--cyan)"],
    67: ["freezing rain", "☂", "var(--cyan)"],
    71: ["light snow", "❄", "var(--ink)"],
    73: ["snow", "❄", "var(--ink)"],
    75: ["heavy snow", "❄", "var(--ink)"],
    77: ["snow grains", "❄", "var(--ink)"],
    80: ["rain showers", "☂", "var(--cyan)"],
    81: ["rain showers", "☂", "var(--cyan)"],
    82: ["heavy showers", "☂", "var(--cyan)"],
    85: ["snow showers", "❄", "var(--ink)"],
    86: ["snow showers", "❄", "var(--ink)"],
    95: ["thunderstorm", "⚡", "var(--magenta)"],
    96: ["storm & hail", "⚡", "var(--magenta)"],
    99: ["storm & hail", "⚡", "var(--magenta)"],
  };

  function meta(code, day) {
    const m = WMO[code] ?? ["—", "◦", "var(--ink-dim)"];
    if (day === 0 && (code === 0 || code === 1))
      return ["clear night", "☾", "var(--violet)"];
    return m;
  }

  // the cached reading is untrusted storage: keep only the numbers and the
  // short label we expect, so a hand-edited payload cannot break the panel
  function cleanSpot(s) {
    if (!s || typeof s !== "object") return null;
    const lat = Number(s.lat);
    const lon = Number(s.lon);
    const at = Number(s.at);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(at))
      return null;
    return {
      lat,
      lon,
      label: typeof s.label === "string" ? s.label.slice(0, 80) : "",
      at,
    };
  }

  function cleanReading(r) {
    if (!r || typeof r !== "object") return null;
    const out = {};
    for (const k of [
      "temp",
      "feels",
      "hum",
      "wind",
      "code",
      "day",
      "hi",
      "lo",
    ]) {
      const n = Number(r[k]);
      if (!Number.isFinite(n)) return null;
      out[k] = n;
    }
    return out;
  }

  // idle | locating | loading | ready | error
  let phase = $state("idle");
  let spot = $state(null); // { lat, lon, label, at }
  let reading = $state(null);
  let stale = $state(false);
  let refreshing = $state(false); // a quiet arrival refetch, reading still shown
  let manual = $state(false); // the type-a-city fallback
  let query = $state("");
  let searching = $state(false);
  let searchErr = $state("");

  const busy = $derived(
    phase === "locating" || phase === "loading" || refreshing,
  );
  const info = $derived(reading ? meta(reading.code, reading.day) : null);

  const ago = $derived.by(() => {
    if (!spot?.at) return "";
    const min = Math.round((Date.now() - spot.at) / 60000);
    if (min < 2) return "just now";
    if (min < 60) return `${min} min ago`;
    return `${Math.round(min / 60)} h ago`;
  });

  onMount(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      const s = cleanSpot(raw?.spot);
      const r = cleanReading(raw?.reading);
      if (s && r) {
        spot = s;
        reading = r;
        stale = Date.now() - s.at > TTL;
        phase = "ready";
        unlock("weather-watcher");
        // a place is already set, so read the sky again on arrival — quietly,
        // keeping the cached reading on screen until the fresh one lands
        readSky(s.lat, s.lon, s.label, true);
      }
    } catch {
      /* a corrupt cache is not worth a complaint — start fresh */
    }
  });

  function keep(s, r) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ spot: s, reading: r }));
    } catch {
      /* private mode: the reading still shows for this visit */
    }
  }

  // `silent` is the arrival refetch: it keeps the cached reading on screen
  // and, if the request fails, keeps showing it rather than blanking to an
  // error — the old number is still the best we have.
  async function readSky(lat, lon, label, silent = false) {
    if (silent) refreshing = true;
    else phase = "loading";
    try {
      const q = new URLSearchParams({
        latitude: Number(lat).toFixed(2),
        longitude: Number(lon).toFixed(2),
        current:
          "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m",
        daily: "temperature_2m_max,temperature_2m_min",
        timezone: "auto",
        forecast_days: "1",
      });
      const res = await fetch(`${FORECAST}?${q}`);
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      const c = j.current;
      const r = {
        temp: Math.round(c.temperature_2m),
        feels: Math.round(c.apparent_temperature),
        hum: Math.round(c.relative_humidity_2m),
        wind: Math.round(c.wind_speed_10m),
        code: c.weather_code,
        day: c.is_day,
        hi: Math.round(j.daily?.temperature_2m_max?.[0] ?? c.temperature_2m),
        lo: Math.round(j.daily?.temperature_2m_min?.[0] ?? c.temperature_2m),
      };
      const s = {
        lat: Number(Number(lat).toFixed(2)),
        lon: Number(Number(lon).toFixed(2)),
        label: label || "",
        at: Date.now(),
      };
      spot = s;
      reading = r;
      keep(s, r);
      stale = false;
      phase = "ready";
      unlock("weather-watcher");
    } catch {
      if (silent && reading) stale = true;
      else phase = "error";
    } finally {
      if (silent) refreshing = false;
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      phase = "idle";
      manual = true;
      searchErr = "this browser will not share a location";
      return;
    }
    phase = "locating";
    navigator.geolocation.getCurrentPosition(
      (pos) => readSky(pos.coords.latitude, pos.coords.longitude, ""),
      () => {
        phase = "idle";
        manual = true;
        searchErr = "location was declined — type a city instead";
      },
      // maximumAge lets the browser reuse a recent fix instead of
      // waking the radio up again, which is both faster and kinder
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 },
    );
  }

  // the one button: read the sky where we already know we are, or ask
  function look() {
    if (spot) readSky(spot.lat, spot.lon, spot.label);
    else locate();
  }

  async function search(e) {
    e.preventDefault();
    const name = query.trim();
    if (!name || searching) return;
    searching = true;
    searchErr = "";
    try {
      const res = await fetch(
        `${GEOCODE}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const hit = (await res.json()).results?.[0];
      if (!hit) {
        searchErr = `nowhere called “${name}”`;
      } else {
        manual = false;
        query = "";
        readSky(
          hit.latitude,
          hit.longitude,
          [hit.name, hit.country_code].filter(Boolean).join(", "),
        );
      }
    } catch {
      searchErr = "the lookup failed";
    }
    searching = false;
  }

  function cancelSearch() {
    manual = false;
    searchErr = "";
    query = "";
  }
</script>

<aside class="wx" aria-label="Local weather">
  <div class="wx__bar">
    <span class="wx__file">weather.dat</span>
    <span class="wx__led" class:wx__led--on={busy} aria-hidden="true"></span>
  </div>

  {#if manual}
    <form class="wx__body" onsubmit={search}>
      <p class="wx__tiny">{reading ? "somewhere else?" : "type a city name"}</p>
      <div class="wx__form">
        <input
          bind:value={query}
          placeholder="paris"
          aria-label="City name"
          autocomplete="off"
        />
        <button class="wx__go" disabled={searching}
          >{searching ? "…" : "go"}</button
        >
      </div>
      {#if searchErr}<p class="wx__tiny wx__err">{searchErr}</p>{/if}
      {#if reading}
        <button type="button" class="wx__tinybtn" onclick={cancelSearch}
          >← back to the reading</button
        >
      {/if}
    </form>
  {:else}
    <div class="wx__live">
      {#if phase === "ready" && reading}
        <div class="wx__body">
          <div class="wx__reading" aria-live="polite">
            <p class="wx__main">
              <span class="wx__glyph" aria-hidden="true" style="--c:{info[2]}"
                >{info[1]}</span
              >
              <b class="wx__temp">{reading.temp}<i>°C</i></b>
            </p>
            <p class="wx__cond" style="--c:{info[2]}">{info[0]}</p>
            <p class="wx__stats">
              hi {reading.hi}° · lo {reading.lo}° · {reading.wind} km/h
            </p>
          </div>
          <p class="wx__foot">
            <button
              class="wx__place"
              title="set a different place"
              onclick={() => (manual = true)}
              >{spot.label || "your location"}</button
            >
            <button class="wx__ref" title="read the sky again" onclick={look}
              >↻{stale ? ` ${ago}` : ""}</button
            >
          </p>
        </div>
      {:else if phase === "locating"}
        <p class="wx__wait" aria-live="polite">
          asking your browser<span class="cursor"></span>
        </p>
      {:else if phase === "loading"}
        <p class="wx__wait" aria-live="polite">
          reading the sky<span class="cursor"></span>
        </p>
      {:else if phase === "error"}
        <div class="wx__body">
          <p class="wx__wait wx__err" aria-live="polite">no reading</p>
          <p class="wx__tiny">open-meteo did not answer. that happens.</p>
          <div class="wx__form">
            <button class="wx__go" onclick={look}>↻ try again</button>
            <button class="wx__go" onclick={() => (manual = true)}
              >type a city</button
            >
          </div>
        </div>
      {:else}
        <button class="wx__idle" onclick={look}>
          <span class="wx__glyph" aria-hidden="true">☀</span>
          <span class="wx__idlecopy">
            <b>local weather</b>
            <small>click · one tiny request</small>
          </span>
        </button>
        <button class="wx__tinybtn" onclick={() => (manual = true)}
          >or type a city</button
        >
      {/if}
    </div>
  {/if}
</aside>

<style>
  .wx {
    width: 208px;
    max-width: 100%;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-dim);
    background: linear-gradient(180deg, var(--panel), var(--bg-2));
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 18px 40px -30px color-mix(in srgb, var(--cyan) 90%, transparent);
    overflow: hidden;
  }

  .wx__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 3px 7px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--cyan) 12%, var(--panel-2)),
      var(--panel)
    );
    border-bottom: 1px solid var(--line);
  }
  .wx__file {
    font-family: var(--pixel);
    font-size: 13px;
    letter-spacing: 0.08em;
    color: var(--ink-faint);
  }
  .wx__led {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ink-faint);
    opacity: 0.55;
  }
  .wx__led--on {
    background: var(--cyan);
    opacity: 1;
    box-shadow: 0 0 9px color-mix(in srgb, var(--cyan) 75%, transparent);
    animation: wx-pulse 1.1s ease-in-out infinite;
  }
  @keyframes wx-pulse {
    50% {
      opacity: 0.35;
    }
  }

  .wx__body {
    display: grid;
    gap: 4px;
    padding: 8px 10px 9px;
  }
  .wx__reading {
    display: grid;
    gap: 4px;
  }

  /* --- the reading --- */
  .wx__main {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .wx__glyph {
    font-size: 23px;
    line-height: 1;
    color: var(--c, var(--gold));
    text-shadow: 0 0 11px
      color-mix(in srgb, var(--c, var(--gold)) 55%, transparent);
  }
  .wx__temp {
    font-family: var(--display);
    font-weight: 700;
    font-size: 27px;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .wx__temp i {
    font-style: normal;
    font-size: 12px;
    font-weight: 400;
    color: var(--ink-faint);
  }
  .wx__cond {
    margin: 0;
    font-size: 11.5px;
    color: var(--c, var(--ink-dim));
  }
  .wx__stats {
    margin: 1px 0 0;
    font-size: 10px;
    letter-spacing: 0.02em;
    color: var(--ink-faint);
  }
  .wx__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin: 5px 0 0;
    padding-top: 6px;
    border-top: 1px dashed var(--line);
  }
  .wx__place,
  .wx__ref {
    padding: 0;
    font-size: 10px;
    background: none;
    border: 0;
    text-align: left;
  }
  .wx__place {
    overflow: hidden;
    color: var(--ink-faint);
    text-decoration: underline dotted;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .wx__place:hover {
    color: var(--lime);
  }
  .wx__ref {
    flex: none;
    color: var(--cyan);
  }
  .wx__ref:hover {
    color: var(--lime);
  }

  /* --- idle --- */
  .wx__idle {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 9px 10px 7px;
    text-align: left;
    background: none;
    border: 0;
    color: inherit;
  }
  .wx__idle .wx__glyph {
    --c: var(--gold);
    font-size: 21px;
  }
  .wx__idlecopy b {
    display: block;
    font-size: 12px;
    color: var(--ink);
  }
  .wx__idlecopy small {
    display: block;
    font-size: 9.5px;
    color: var(--ink-faint);
  }
  .wx__idle:hover .wx__glyph {
    text-shadow: 0 0 16px color-mix(in srgb, var(--gold) 70%, transparent);
  }
  .wx__idle:hover small {
    color: var(--ink-dim);
  }

  .wx__wait {
    margin: 0;
    padding: 9px 10px;
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }

  /* --- the city fallback --- */
  .wx__form {
    display: flex;
    gap: 5px;
  }
  .wx__form input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 4px 6px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink);
    background: var(--well);
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
  }
  .wx__form input:focus {
    outline: none;
    border-color: var(--lime);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--lime) 22%, transparent);
  }
  .wx__go {
    flex: none;
    padding: 4px 9px;
    font-family: var(--mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink);
    background: color-mix(in srgb, var(--cyan) 14%, transparent);
    border: 1px solid var(--line-hot);
    border-radius: var(--radius);
  }
  .wx__go:hover:not(:disabled) {
    background: color-mix(in srgb, var(--cyan) 26%, transparent);
    border-color: var(--cyan);
  }
  .wx__go:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  .wx__tiny {
    margin: 0;
    font-size: 10px;
    color: var(--ink-faint);
  }
  .wx__err {
    color: var(--orange);
  }
  .wx__tinybtn {
    display: block;
    width: 100%;
    padding: 0 10px 8px;
    font-size: 10px;
    color: var(--cyan);
    text-align: left;
    background: none;
    border: 0;
  }
  .wx__tinybtn:hover {
    color: var(--lime);
  }

  @media (prefers-reduced-motion: reduce) {
    .wx__led--on {
      animation: none;
    }
  }
</style>
