// ============================================================
// focus trap
//
// A dialog that only *looks* modal is a trap for keyboard users:
// Tab walks straight out into the page behind the veil, and closing
// it drops focus back at the top of the document. This action keeps
// Tab inside the dialog while it is open, and hands focus back to
// whatever was focused before it opened.
//
// Used as `use:trapFocus` on the dialog element. The element to
// focus on open is the first `[data-autofocus]` inside it, else the
// dialog itself (it carries tabindex="-1"), else its first control.
// ============================================================

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function trapFocus(node) {
  const previous = document.activeElement;

  const focusable = () =>
    [...node.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.getClientRects().length > 0,
    );

  function onKeydown(e) {
    if (e.key !== "Tab") return;
    const items = focusable();
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // the dialog node itself counts as a boundary
    const inside = active !== node && node.contains(active);
    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const start = node.querySelector("[data-autofocus]");
  if (start) start.focus();
  else if (node.hasAttribute("tabindex")) node.focus();
  else focusable()[0]?.focus();

  node.addEventListener("keydown", onKeydown);
  return {
    destroy() {
      node.removeEventListener("keydown", onKeydown);
      if (previous instanceof HTMLElement && document.contains(previous))
        previous.focus();
    },
  };
}
