// ============================================================
// the tip jar
//
// One line to change: point KOFI at your own ko-fi username, or set
// it to "" to remove the button entirely.
//
// It is deliberately a plain link, not ko-fi's own widget. Their
// widget is either a third-party script or an iframe, and both would
// pull ko-fi's code into every visit — the one thing this page
// promises not to do. A link costs nothing until someone clicks it,
// so the CSP never has to open up for it.
// ============================================================

export const KOFI = "koinot";
export const KOFI_URL = KOFI ? `https://ko-fi.com/${KOFI}` : "";
