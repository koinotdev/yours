// In-page navigation that leaves the url alone.
//
// The rail, the masthead and the badges all link to sections by id. A
// hash in the address bar is sticky, though: reload and the browser
// jumps you back to wherever you last clicked, which is not where you
// wanted to be. So the links keep their href — keyboard, middle-click
// and the status bar all still work — but a plain left click is
// intercepted and the scroll is done by hand.
//
// The only hash this page ever keeps is #synth, which is a real
// address you can reload or share. See App.svelte.

export function plainClick(e) {
  // modified clicks (new tab, new window, …) belong to the browser
  return !(
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  );
}

export function jump(e) {
  if (!plainClick(e)) return;
  const href = e.currentTarget?.getAttribute?.("href") || "";
  if (!href.startsWith("#")) return;
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  e.preventDefault();
  // no behaviour option: the css `scroll-behavior` decides, which is
  // also what makes prefers-reduced-motion turn the glide off
  el.scrollIntoView();
}
