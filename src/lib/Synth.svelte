<script>
  import { onMount } from "svelte";
  import { isTyping } from "./secret.js";
  import { unlock } from "./achievements.svelte.js";
  import {
    NOTES,
    WAVES,
    PEAK,
    freq,
    TAPE_MAX,
    loadTape,
    saveTape,
    loadSound,
    saveSound,
  } from "./tape.js";
  import { readStore, writeStore, share } from "./share.svelte.js";

  let { onExit } = $props();

  /* ---------- the notes ---------- */
  // one chromatic octave, and the two layouts that can play it
  const WHITE_IDX = [0, 2, 4, 5, 7, 9, 11, 12];
  const BLACK_IDX = [1, 3, 6, 8, 10];
  // left = the gap between two white keys, minus half a black key
  const BLACK_LEFT = ["8.7%", "21.2%", "46.2%", "58.7%", "71.2%"];

  // the same physical keys on both — only the printed letters differ
  const LAYOUTS = {
    azerty: ["q", "z", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k"],
    qwerty: ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k"],
  };

  let layout = $state("azerty");
  const keys = $derived(LAYOUTS[layout]);
  const whiteKeys = $derived(
    WHITE_IDX.map((i) => ({ note: NOTES[i], key: keys[i] })),
  );
  const blackKeys = $derived(
    BLACK_IDX.map((i, n) => ({
      note: NOTES[i],
      key: keys[i],
      left: BLACK_LEFT[n],
    })),
  );
  const keymap = $derived(
    Object.fromEntries(keys.map((k, i) => [k, NOTES[i]])),
  );

  /* ---------- the knobs ---------- */
  // restored from the last session and saved back as they change, so
  // the arrival greeting can sound like the take you actually played
  const sound = loadSound();
  let wave = $state(sound.wave);
  let attack = $state(sound.attack);
  let release = $state(sound.release);
  let cutoff = $state(sound.cutoff);
  let volume = $state(sound.volume);

  /* ---------- ui ---------- */
  let held = $state([]);
  let meterEl;

  /* ---------- the tape ----------
     A take is only the notes you played, with times — no audio is
     captured, so it stays a few hundred bytes and can be re-performed
     through whatever the knobs say now. A small sequencer that remembers
     your hands. */

  let take = $state({ events: [] });
  let recording = $state(false);
  let playing = $state(false);
  let loop = $state(false);

  let recT0 = 0;
  let replaying = false; // guards the recorder against its own playback
  const recOpen = new Map(); // note -> index of its open event
  let playRaf = 0;

  const takeLen = $derived(
    take.events.reduce((m, e) => Math.max(m, e.t + Math.max(0.05, e.d)), 0),
  );

  // the piano roll: time across, pitch up
  const roll = $derived.by(() => {
    const len = takeLen;
    if (!len) return [];
    return take.events.map((e, i) => {
      const idx = Math.max(0, NOTES.indexOf(e.n));
      return {
        i,
        left: (e.t / len) * 100,
        width: Math.max(1.4, (Math.max(0.05, e.d) / len) * 100),
        top: ((NOTES.length - 1 - idx) / NOTES.length) * 100,
        black: e.n.includes("#"),
      };
    });
  });

  /* ---------- the audio graph (plain values, never reactive) ---------- */
  let ac = null;
  let filter = null;
  let master = null;
  let analyser = null;
  const voices = new Map();
  let raf = 0;
  let quiet = 0;
  let reduced = false;

  // built on the first gesture, never on mount — browsers block autoplay
  function ensureAudio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      filter = ac.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      filter.Q.value = 0.9;
      master = ac.createGain();
      master.gain.value = volume;
      analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      filter.connect(master);
      master.connect(analyser);
      analyser.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return true;
  }

  function noteOn(note) {
    if (voices.has(note) || !ensureAudio()) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq(note);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(PEAK, t + Math.max(0.003, attack));
    osc.connect(g);
    g.connect(filter);
    osc.start(t);
    voices.set(note, { osc, g });
    held = [...held, note];
    startMeter();
    if (recording && !replaying) {
      if (take.events.length >= TAPE_MAX) stopRec();
      else {
        // the take starts with the first note, not the button press, so
        // there is no dead air in front of it
        if (!take.events.length) recT0 = t;
        take.events.push({ n: note, t: t - recT0, d: 0.2 });
        recOpen.set(note, take.events.length - 1);
      }
    }
  }

  function noteOff(note) {
    const v = voices.get(note);
    if (!v) return;
    voices.delete(note);
    held = held.filter((n) => n !== note);
    if (recording && !replaying && recOpen.has(note)) {
      const idx = recOpen.get(note);
      const ev = take.events[idx];
      if (ev) ev.d = Math.max(0.05, ac.currentTime - recT0 - ev.t);
      recOpen.delete(note);
    }
    const t = ac.currentTime;
    const rel = Math.max(0.02, release);
    const g = v.g.gain;
    // always ramp — an abrupt gain change clicks
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
    }
    g.linearRampToValueAtTime(0, t + rel);
    v.osc.stop(t + rel + 0.04);
    v.osc.onended = () => {
      try {
        g.disconnect();
        v.osc.disconnect();
      } catch {
        /* node already gone */
      }
    };
  }

  function allOff() {
    for (const note of [...voices.keys()]) noteOff(note);
  }

  /* ---------- the tape: record & replay ---------- */

  function startRec() {
    if (!ensureAudio()) return;
    stopPlay();
    allOff();
    take.events = [];
    recOpen.clear();
    // armed, but the clock does not start until the first note — see noteOn
    recT0 = 0;
    recording = true;
  }

  function stopRec() {
    if (!recording) return;
    // a key still held when you hit stop gets a duration up to now
    const now = ac.currentTime - recT0;
    for (const [, idx] of recOpen) {
      const ev = take.events[idx];
      if (ev) ev.d = Math.max(0.05, now - ev.t);
    }
    recOpen.clear();
    recording = false;
    saveTape(take.events);
    if (take.events.length) unlock("tape-deck");
  }

  function startPlay() {
    if (!take.events.length || !ensureAudio()) return;
    stopRec();
    allOff();
    unlock("composer");
    playing = true;
    replaying = true;
    let t0 = ac.currentTime;
    let i = 0;
    let offs = [];
    const tick = () => {
      const el = ac.currentTime - t0;
      while (i < take.events.length && take.events[i].t <= el) {
        const e = take.events[i++];
        noteOn(e.n);
        offs.push({ n: e.n, at: e.t + Math.max(0.05, e.d) });
      }
      for (let k = offs.length - 1; k >= 0; k--) {
        if (offs[k].at <= el) {
          noteOff(offs[k].n);
          offs.splice(k, 1);
        }
      }
      if (i >= take.events.length && !offs.length) {
        if (loop) {
          t0 = ac.currentTime;
          i = 0;
          offs = [];
        } else {
          playing = false;
          replaying = false;
          playRaf = 0;
          return;
        }
      }
      playRaf = requestAnimationFrame(tick);
    };
    playRaf = requestAnimationFrame(tick);
  }

  function stopPlay() {
    if (playRaf) cancelAnimationFrame(playRaf);
    playRaf = 0;
    if (!playing && !replaying) return;
    playing = false;
    replaying = false;
    allOff();
  }

  function clearTape() {
    stopPlay();
    // stop recording first: a held key would otherwise leave an index in
    // recOpen pointing into the array we are about to empty
    stopRec();
    take.events = [];
    saveTape(take.events);
  }

  const toggleRec = () => (recording ? stopRec() : startRec());
  const togglePlay = () => (playing ? stopPlay() : startPlay());
  function toggleLoop() {
    loop = !loop;
    if (loop) unlock("loop-master");
  }

  /* ---------- a small level meter, driven straight to the dom ---------- */
  function startMeter() {
    if (raf || !analyser || reduced) return;
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const x = (data[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / data.length);
      if (meterEl) meterEl.style.width = `${Math.min(100, rms * 260)}%`;
      if (voices.size === 0 && rms < 0.004) {
        if (++quiet > 24) {
          raf = 0;
          quiet = 0;
          if (meterEl) meterEl.style.width = "0%";
          return;
        }
      } else {
        quiet = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  /* ---------- properties stay live while you hold a note ---------- */
  $effect(() => {
    const w = wave;
    for (const v of voices.values()) v.osc.type = w;
  });
  $effect(() => {
    if (filter && ac)
      filter.frequency.setTargetAtTime(cutoff, ac.currentTime, 0.01);
  });
  $effect(() => {
    if (master && ac) master.gain.setTargetAtTime(volume, ac.currentTime, 0.02);
  });
  // remember the knobs so the arrival greeting can sound like this take.
  // a slider drag fires this on every pointermove, so the write is
  // debounced — one localStorage hit per gesture instead of dozens.
  let saveTimer = 0;
  const flushSound = () => {
    clearTimeout(saveTimer);
    saveTimer = 0;
    saveSound({ wave, attack, release, cutoff, volume });
  };
  $effect(() => {
    const next = { wave, attack, release, cutoff, volume };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveSound(next), 200);
  });

  // a guest link swaps the room out from under us: re-read the knobs and
  // the key layout from wherever the stores now point. In guest mode the
  // tape is not shared, so the take stays empty — only the sound travels.
  $effect(() => {
    share.payload;
    const s = loadSound();
    wave = s.wave;
    attack = s.attack;
    release = s.release;
    cutoff = s.cutoff;
    volume = s.volume;
    const l = readStore("synth.layout");
    if (l === "azerty" || l === "qwerty") layout = l;
  });

  /* ---------- input ---------- */
  // the game is a modal that also listens for WASD — don't play over it
  const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

  function setLayout(l) {
    if (l === layout) return;
    allOff();
    layout = l;
    writeStore("synth.layout", l);
  }

  function press(note, e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    noteOn(note);
  }
  const lift = (note) => noteOff(note);

  // the keys are buttons, so they must play from the keyboard too
  function keyDown(note, e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    noteOn(note);
  }
  function keyUp(note, e) {
    if (e.key === "Enter" || e.key === " ") noteOff(note);
  }

  onMount(() => {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saved = readStore("synth.layout");
    if (saved === "azerty" || saved === "qwerty") layout = saved;
    take.events = loadTape();

    const down = (e) => {
      if (
        e.repeat ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(e) ||
        modalOpen()
      )
        return;
      const note = keymap[e.key.toLowerCase()];
      if (!note) return;
      e.preventDefault();
      noteOn(note);
    };
    const up = (e) => {
      const note = keymap[e.key.toLowerCase()];
      if (note) noteOff(note);
    };
    const blur = () => allOff();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    // a debounced write must not be lost if the tab is closed mid-drag
    window.addEventListener("pagehide", flushSound);
    document.addEventListener("visibilitychange", flushSound);
    // nor a take still being recorded — stopRec is what writes it down
    window.addEventListener("pagehide", stopRec);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", flushSound);
      document.removeEventListener("visibilitychange", flushSound);
      window.removeEventListener("pagehide", stopRec);
      stopRec();
      if (saveTimer) flushSound();
      if (raf) cancelAnimationFrame(raf);
      if (playRaf) cancelAnimationFrame(playRaf);
      if (ac) ac.close();
    };
  });
</script>

<div class="page">
  <div class="wrap">
    <div class="page__bar">
      <button class="page__back" onclick={onExit}>← back to home</button>
      <span class="page__url">yours://home/synth.exe</span>
      <span class="page__tag">web audio · no deps · no requests</span>
    </div>

    <section class="panel">
      <div class="panel__bar">
        <span class="panel__title">synth.exe</span>
        <span class="winbtns" aria-hidden="true"><i>_</i><i>□</i><i>✕</i></span>
      </div>

      <div class="panel__body">
        <div class="scope">
          <span class="scope__label">out</span>
          <span class="scope__meter" aria-hidden="true"
            ><i bind:this={meterEl}></i></span
          >
        </div>

        <div class="tape">
          <button
            class="tape__btn"
            class:is-rec={recording}
            onclick={toggleRec}
            aria-pressed={recording}
            title="record what you play"
          >
            {recording ? "■ stop" : "● rec"}
          </button>
          <button
            class="tape__btn"
            class:is-play={playing}
            onclick={togglePlay}
            disabled={!take.events.length}
            aria-pressed={playing}
            title="replay the take"
          >
            {playing ? "■ stop" : "▶ play"}
          </button>
          <button
            class="tape__btn"
            class:is-on={loop}
            onclick={toggleLoop}
            aria-pressed={loop}
            title="loop the take"
          >
            ↻ loop
          </button>
          <button
            class="tape__btn"
            onclick={clearTape}
            disabled={!take.events.length}
            title="erase the take"
          >
            ✕ clear
          </button>
          <span class="tape__meta">
            {take.events.length} notes · {takeLen.toFixed(1)}s
          </span>
        </div>

        {#if roll.length}
          <div class="roll" aria-hidden="true">
            {#each roll as r (r.i)}
              <i
                class="roll__note"
                class:is-black={r.black}
                style="left:{r.left}%;width:{r.width}%;top:{r.top}%"
              ></i>
            {/each}
          </div>
        {/if}

        <div class="keys" role="group" aria-label="Playable keyboard">
          {#each whiteKeys as k}
            <button
              class="key key--white"
              class:is-on={held.includes(k.note)}
              onpointerdown={(e) => press(k.note, e)}
              onpointerup={() => lift(k.note)}
              onpointercancel={() => lift(k.note)}
              onkeydown={(e) => keyDown(k.note, e)}
              onkeyup={(e) => keyUp(k.note, e)}
              aria-label={k.note}
            >
              <span class="key__cap">{k.key}</span>
            </button>
          {/each}

          {#each blackKeys as k}
            <button
              class="key key--black"
              class:is-on={held.includes(k.note)}
              style="left:{k.left}"
              onpointerdown={(e) => press(k.note, e)}
              onpointerup={() => lift(k.note)}
              onpointercancel={() => lift(k.note)}
              onkeydown={(e) => keyDown(k.note, e)}
              onkeyup={(e) => keyUp(k.note, e)}
              aria-label={k.note}
            >
              <span class="key__cap">{k.key}</span>
            </button>
          {/each}
        </div>

        <div class="ctrls">
          <div class="ctrl">
            <span class="ctrl__label">waveform</span>
            <div class="waves">
              {#each WAVES as w}
                <button
                  class:is-on={wave === w}
                  aria-pressed={wave === w}
                  onclick={() => (wave = w)}
                >
                  {w}
                </button>
              {/each}
            </div>
          </div>

          <div class="ctrl">
            <span class="ctrl__label">keyboard</span>
            <div class="waves">
              {#each Object.keys(LAYOUTS) as l}
                <button
                  class:is-on={layout === l}
                  aria-pressed={layout === l}
                  onclick={() => setLayout(l)}
                >
                  {l}
                </button>
              {/each}
            </div>
          </div>

          <label class="ctrl">
            <span class="ctrl__label">
              attack <b class="ctrl__val">{Math.round(attack * 1000)}ms</b>
            </span>
            <input
              type="range"
              min="0.003"
              max="0.6"
              step="0.003"
              bind:value={attack}
            />
          </label>

          <label class="ctrl">
            <span class="ctrl__label">
              release <b class="ctrl__val">{Math.round(release * 1000)}ms</b>
            </span>
            <input
              type="range"
              min="0.02"
              max="1.6"
              step="0.02"
              bind:value={release}
            />
          </label>

          <label class="ctrl">
            <span class="ctrl__label">
              cutoff <b class="ctrl__val">{Math.round(cutoff)}hz</b>
            </span>
            <input
              type="range"
              min="120"
              max="9000"
              step="20"
              bind:value={cutoff}
            />
          </label>

          <label class="ctrl">
            <span class="ctrl__label">
              volume <b class="ctrl__val">{Math.round(volume * 100)}%</b>
            </span>
            <input
              type="range"
              min="0"
              max="0.6"
              step="0.01"
              bind:value={volume}
            />
          </label>
        </div>

        <p class="hint">
          hold a key, or play with your keyboard — <b>{keys.join(" ")}</b>
        </p>
      </div>
    </section>
  </div>
</div>

<style>
  .page {
    position: relative;
    z-index: 1;
    padding-block: 18px 0;
  }

  .page__bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .page__back {
    padding: 5px 12px;
    font-size: 11.5px;
    letter-spacing: 0.04em;
    color: var(--cyan);
    background: color-mix(in srgb, var(--cyan) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--cyan) 45%, transparent);
    border-radius: 99px;
    transition:
      background 0.15s ease,
      transform 0.12s ease;
  }
  .page__back:hover {
    background: color-mix(in srgb, var(--cyan) 16%, transparent);
    transform: translateX(-2px);
  }

  .page__url {
    font-family: var(--pixel);
    font-size: 17px;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
    padding: 1px 12px;
    border: 1px solid var(--line);
    border-radius: 99px;
    background: rgba(0, 0, 0, 0.35);
  }

  .page__tag {
    margin-left: auto;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  /* ---------- level meter ---------- */
  .scope {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .scope__label {
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .scope__meter {
    flex: 1;
    height: 10px;
    background: var(--well);
    border: 1px solid var(--line);
    border-radius: 99px;
    overflow: hidden;
  }
  .scope__meter i {
    display: block;
    width: 0;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--leaf),
      var(--lime) 40%,
      var(--gold) 72%,
      var(--magenta)
    );
    box-shadow: 0 0 16px -2px var(--lime);
  }

  /* ---------- the tape ---------- */
  .tape {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  .tape__btn {
    padding: 5px 11px;
    font-family: var(--pixel);
    font-size: 16px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
    background: var(--well);
    border: 1px solid var(--line);
    border-radius: 4px;
    transition:
      color 0.12s ease,
      background 0.12s ease,
      box-shadow 0.12s ease;
  }
  .tape__btn:hover:not(:disabled) {
    color: var(--ink);
    background: var(--panel-2);
  }
  .tape__btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .tape__btn.is-rec {
    color: var(--on-accent);
    background: var(--magenta);
    border-color: var(--magenta);
    box-shadow: var(--glow-magenta);
  }
  .tape__btn.is-play {
    color: var(--on-accent);
    background: var(--lime);
    border-color: var(--lime);
    box-shadow: var(--glow-lime);
  }
  .tape__btn.is-on {
    color: var(--on-accent);
    background: var(--cyan);
    border-color: var(--cyan);
    box-shadow: var(--glow-cyan);
  }
  .tape__meta {
    margin-left: auto;
    font-family: var(--pixel);
    font-size: 16px;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }

  /* the take, drawn as a tracker strip: time across, pitch up */
  .roll {
    position: relative;
    height: 58px;
    margin-bottom: 16px;
    background: var(--well);
    border: 1px solid var(--line);
    border-radius: 4px;
    overflow: hidden;
  }
  .roll__note {
    position: absolute;
    height: 4px;
    min-width: 2px;
    border-radius: 1px;
    background: var(--lime);
    box-shadow: 0 0 8px -2px var(--lime);
  }
  .roll__note.is-black {
    background: var(--cyan);
    box-shadow: 0 0 8px -2px var(--cyan);
  }

  /* ---------- the keyboard ---------- */
  .keys {
    position: relative;
    display: flex;
    gap: 4px;
    height: clamp(120px, 22vw, 168px);
    margin-bottom: 18px;
    user-select: none;
    touch-action: none;
  }

  .key {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 9px;
    border-radius: 0 0 4px 4px;
    transition:
      background 0.07s linear,
      box-shadow 0.15s ease,
      transform 0.07s linear;
  }
  .key__cap {
    font-family: var(--pixel);
    font-size: 15px;
    letter-spacing: 0.06em;
    opacity: 0.85;
  }

  .key--white {
    flex: 1;
    color: var(--ink-faint);
    background: linear-gradient(180deg, var(--panel-2), var(--well));
    border: 1px solid var(--line-hot);
    box-shadow: inset 0 -10px 18px -12px rgba(0, 0, 0, 0.9);
  }
  .key--white:hover {
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
  }
  .key--white.is-on {
    color: var(--on-accent);
    background: linear-gradient(180deg, var(--lime), var(--leaf));
    border-color: var(--lime);
    box-shadow:
      0 0 26px -4px var(--lime),
      inset 0 0 20px color-mix(in srgb, var(--on-accent) 35%, transparent);
    transform: translateY(2px);
  }

  .key--black {
    position: absolute;
    top: 0;
    width: 7.6%;
    height: 62%;
    z-index: 2;
    color: var(--ink-faint);
    background: linear-gradient(180deg, var(--panel), var(--bg));
    border: 1px solid #000;
    box-shadow:
      0 6px 12px -6px #000,
      inset 0 -8px 14px -10px rgba(255, 255, 255, 0.12);
  }
  .key--black:hover {
    background: linear-gradient(180deg, var(--panel-2), var(--well));
  }
  .key--black.is-on {
    color: var(--on-accent);
    background: linear-gradient(
      180deg,
      var(--cyan),
      color-mix(in srgb, var(--cyan) 58%, #000)
    );
    border-color: var(--cyan);
    box-shadow:
      0 0 26px -4px var(--cyan),
      inset 0 0 18px color-mix(in srgb, var(--on-accent) 40%, transparent);
    transform: translateY(2px);
  }

  /* ---------- properties ---------- */
  .ctrls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px 22px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }

  .ctrl {
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .ctrl__label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .ctrl__val {
    font-family: var(--pixel);
    font-size: 15px;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--lime);
    text-shadow: var(--glow-lime);
  }

  .waves {
    display: flex;
  }
  .waves button {
    flex: 1;
    padding: 7px 2px;
    font-size: 9.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
    background: var(--well);
    border: 1px solid var(--line);
    border-right-width: 0;
    transition:
      color 0.12s ease,
      background 0.12s ease;
  }
  .waves button:first-child {
    border-radius: 4px 0 0 4px;
  }
  .waves button:last-child {
    border-right-width: 1px;
    border-radius: 0 4px 4px 0;
  }
  .waves button:hover {
    color: var(--ink);
    background: var(--panel-2);
  }
  .waves button.is-on {
    color: var(--on-accent);
    background: var(--lime);
    border-color: var(--lime);
    box-shadow: var(--glow-lime);
  }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    margin: 0;
    background: var(--well);
    border: 1px solid var(--line);
    border-radius: 99px;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--lime);
    border: 1px solid var(--on-accent);
    box-shadow: var(--glow-lime);
    cursor: grab;
  }
  input[type="range"]::-webkit-slider-thumb:active {
    cursor: grabbing;
  }
  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--lime);
    border: 1px solid var(--on-accent);
    box-shadow: var(--glow-lime);
    cursor: grab;
  }
  input[type="range"]:focus-visible {
    border-color: var(--lime);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--lime) 25%, transparent);
  }

  .hint {
    margin: 16px 0 0;
    font-size: 11px;
    color: var(--ink-faint);
    text-align: center;
  }
  .hint b {
    color: var(--ink-dim);
    font-weight: 400;
    letter-spacing: 0.14em;
  }
</style>
