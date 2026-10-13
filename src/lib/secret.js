// A tiny pub/sub so any component can summon a hidden thing
// without threading callbacks through the whole tree.

const VINE = "vine:open";
const SYNTH = "synth:open";

function emit(name) {
  window.dispatchEvent(new CustomEvent(name));
}

function listen(name, fn) {
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}

export const openSecret = () => emit(VINE);
export const onSecret = (fn) => listen(VINE, fn);

// the synth is its own view, so this just asks
// the app to swap pages.
export const openSynth = () => emit(SYNTH);
export const onSynth = (fn) => listen(SYNTH, fn);

/* ---------- typed sequences ---------- */

export function isTyping(e) {
  const t = e.target;
  if (!t || !t.tagName) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable === true
  );
}

// Watch for a sequence of keys typed anywhere on the page.
function watchKeys(seq, fn) {
  let i = 0;
  const handler = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === seq[i]) {
      i++;
      if (i === seq.length) {
        i = 0;
        fn();
      }
    } else {
      // allow a fresh start if the first key matches again
      i = key === seq[0] ? 1 : 0;
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

// ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export const watchKonami = (fn) => watchKeys(KONAMI, fn);

// type the word and the synth page opens.
export const watchSynth = (fn) => watchKeys(["s", "y", "n", "t", "h"], fn);
