// ============================================================
// the tape
//
// A take is not audio. It is the notes you played, with times —
// { n, t, d } — so it stays a few hundred bytes, survives a
// reload, and can be re-performed through whatever the knobs say
// now. synth.exe records it and replays it through its live
// voices; the arrival greeting replays it through a throwaway
// graph, because the synth is not mounted on the home page.
//
// This module owns the note vocabulary and the storage, so both
// players agree on what a tape is. Nothing read back from
// localStorage is trusted — same discipline as the config.
// ============================================================

import { readStore, writeStore } from "./share.svelte.js";

export const NOTES = [
  "C4",
  "C#4",
  "D4",
  "D#4",
  "E4",
  "F4",
  "F#4",
  "G4",
  "G#4",
  "A4",
  "A#4",
  "B4",
  "C5",
];
export const WAVES = ["sine", "square", "sawtooth", "triangle"];
export const PEAK = 0.55;

const SEMI = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

export function freq(note) {
  const m = /^([A-G]#?)(\d)$/.exec(note);
  if (!m) return 440;
  const midi = (Number(m[2]) + 1) * 12 + SEMI[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

/* ---------- the take ---------- */

const TAPE_KEY = "synth.tape";
export const TAPE_MAX = 1000;

function sanitizeTape(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e) =>
        e &&
        typeof e.n === "string" &&
        NOTES.includes(e.n) &&
        Number.isFinite(e.t) &&
        Number.isFinite(e.d),
    )
    .slice(0, TAPE_MAX)
    .map((e) => ({
      n: e.n,
      t: Math.max(0, e.t),
      d: Math.min(10, Math.max(0.05, e.d)),
    }));
}

export function loadTape() {
  try {
    return sanitizeTape(JSON.parse(readStore(TAPE_KEY) || "null"));
  } catch {
    return [];
  }
}

export function saveTape(events) {
  writeStore(TAPE_KEY, JSON.stringify(events));
}

/* ---------- the sound ----------
   The knobs, remembered so the arrival greeting can sound like the
   take you actually played rather than the factory defaults. */

const SOUND_KEY = "synth.sound";
const SOUND_DEFAULTS = {
  wave: "sawtooth",
  attack: 0.012,
  release: 0.28,
  cutoff: 2400,
  volume: 0.2,
};

function sanitizeSound(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const num = (v, lo, hi, fallback) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  return {
    wave: WAVES.includes(r.wave) ? r.wave : SOUND_DEFAULTS.wave,
    attack: num(r.attack, 0.003, 0.6, SOUND_DEFAULTS.attack),
    release: num(r.release, 0.02, 1.6, SOUND_DEFAULTS.release),
    cutoff: num(r.cutoff, 120, 9000, SOUND_DEFAULTS.cutoff),
    volume: num(r.volume, 0, 0.6, SOUND_DEFAULTS.volume),
  };
}

export function loadSound() {
  try {
    return sanitizeSound(JSON.parse(readStore(SOUND_KEY) || "null"));
  } catch {
    return { ...SOUND_DEFAULTS };
  }
}

export function saveSound(sound) {
  writeStore(SOUND_KEY, JSON.stringify(sanitizeSound(sound)));
}

/* ---------- the one-shot player ----------
   Replays a take through a throwaway graph and closes it when the
   last note has rung out, so we never hold the audio device open.

   It resolves to true only if the sound actually started. Browsers
   block audio until a real gesture, and a context made without one
   comes back suspended — so we check for activation first, and if a
   context still won't run we close it quietly and report false. The
   caller can then wait for the next gesture and try again. */

export function playTape(events, sound = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !Array.isArray(events) || !events.length)
    return Promise.resolve(false);

  // if the browser can tell us there is no transient activation, don't
  // even build a context — it would only warn and start suspended
  if (navigator.userActivation && !navigator.userActivation.isActive) {
    return Promise.resolve(false);
  }

  const s = { ...SOUND_DEFAULTS, ...sound };
  let ac;
  try {
    ac = new AC();
  } catch {
    return Promise.resolve(false);
  }

  const close = () => {
    try {
      if (ac.state !== "closed") ac.close().catch(() => {});
    } catch {
      /* already closed */
    }
  };

  const schedule = () => {
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = s.cutoff;
    filter.Q.value = 0.9;
    const master = ac.createGain();
    master.gain.value = s.volume;
    filter.connect(master);
    master.connect(ac.destination);

    const t0 = ac.currentTime + 0.06;
    const atk = Math.max(0.003, s.attack);
    let end = t0;

    for (const e of events) {
      const start = t0 + e.t;
      const dur = Math.max(0.05, e.d);
      // a very short note under a long attack still gets its full swell
      const hold = Math.max(start + dur, start + atk);
      const osc = ac.createOscillator();
      osc.type = s.wave;
      osc.frequency.value = freq(e.n);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(PEAK, start + atk);
      g.gain.setValueAtTime(PEAK, hold);
      g.gain.linearRampToValueAtTime(0, hold + s.release);
      osc.connect(g);
      g.connect(filter);
      osc.start(start);
      osc.stop(hold + s.release + 0.04);
      end = Math.max(end, hold + s.release + 0.04);
    }

    const ms = Math.max(0, (end - ac.currentTime) * 1000) + 120;
    setTimeout(close, ms);
  };

  if (ac.state === "running") {
    schedule();
    return Promise.resolve(true);
  }

  // suspended: try once to bring it up, and never close while that
  // resume is still in flight — that is what throws "closed before
  // resume completed"
  return ac
    .resume()
    .then(() => {
      if (ac.state !== "running") {
        close();
        return false;
      }
      schedule();
      return true;
    })
    .catch(() => {
      close();
      return false;
    });
}
