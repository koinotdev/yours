// ============================================================
// drag a window by its title bar to move it up or down the column
//
// The gesture is the desktop one: take the bar, and the window
// follows the pointer past its neighbours. The order lives in the
// config, so it is remembered, travels with an exported "home",
// and settings.cfg can put it back the way it was built.
//
// One neighbour is swapped per pointermove. The DOM
// updates asynchronously, so a loop would read stale geometry — and
// a single step can never bounce back, because the neighbour it has
// just passed has moved out of the way.
// ============================================================

import { flushSync } from "svelte";
import { WINDOW_IDS } from "./config.svelte.js";
import { swapWindows } from "./windows.svelte.js";

// a press on any of these is a press on the control
const INTERACTIVE = "button, a, input, textarea, select, label";
const THRESHOLD = 4; // px of travel before a press becomes a drag

export function sortable(node) {
  let drag = null;

  const mid = (el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };

  function onDown(e) {
    if (e.button !== 0) return;
    // touch keeps its scroll: the bar is too big a target to swallow it
    if (e.pointerType === "touch") return;
    const bar = e.target.closest?.(".panel__bar");
    if (!bar || !node.contains(bar)) return;
    if (e.target.closest(INTERACTIVE)) return;
    const panel = bar.closest(".panel");
    if (!panel || !WINDOW_IDS.includes(panel.id)) return;

    drag = { id: panel.id, el: panel, y0: e.clientY, moved: false };
    e.preventDefault();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  }

  function onMove(e) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y0) < THRESHOLD) return;
      drag.moved = true;
      drag.el.dataset.drag = "";
      document.body.classList.add("is-sorting");
    }
    // the open panels, in the order they are drawn
    const panels = [...node.querySelectorAll(":scope > .panel")];
    const i = panels.indexOf(drag.el);
    if (i < 0) return;
    const below = panels[i + 1];
    const above = panels[i - 1];
    // flushSync so the next move reads the new geometry rather than the
    // old — otherwise two moves in one frame could undo each other
    if (below && e.clientY > mid(below))
      flushSync(() => swapWindows(drag.id, below.id));
    else if (above && e.clientY < mid(above))
      flushSync(() => swapWindows(drag.id, above.id));
  }

  function onUp() {
    if (!drag) return;
    delete drag.el.dataset.drag;
    document.body.classList.remove("is-sorting");
    drag = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("blur", onUp);
  }

  node.addEventListener("pointerdown", onDown);
  return {
    destroy() {
      node.removeEventListener("pointerdown", onDown);
      onUp();
    },
  };
}
