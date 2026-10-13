// ============================================================
// scroll lock
//
// A modal veil is `position: fixed`, so it covers the page but does
// not stop a wheel from reaching the document behind it — and once a
// dialog's own scroll reaches its end, the scroll chains out to the
// body too. Locking the root while a modal is open keeps the page
// behind it still.
//
// It is a counter, so two modals closing in any order cannot
// unlock early. The scrollbar's width is added back as padding, so
// the page behind does not jump sideways when it disappears.
// ============================================================

let depth = 0;
let y = 0;

export function lockScroll() {
  if (depth++ > 0) return;
  const root = document.documentElement;
  const gap = window.innerWidth - root.clientWidth;
  y = window.scrollY;
  root.style.overflow = "hidden";
  if (gap > 0) document.body.style.paddingRight = `${gap}px`;
}

export function unlockScroll() {
  if (depth === 0 || --depth > 0) return;
  const root = document.documentElement;
  root.style.overflow = "";
  document.body.style.paddingRight = "";
  // the offset is normally kept while the root is clipped; pin it anyway,
  // with the page's smooth-scroll easing switched off for the one call, so
  // a browser that did reset it does not animate back
  const ease = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, y);
  root.style.scrollBehavior = ease;
}
