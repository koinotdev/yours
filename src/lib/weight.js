// ============================================================
// What did this visit actually pull over the wire?
//
// The Resource Timing API reports `transferSize` per request. The fonts
// are self-hosted, so they are same-origin and their bytes are visible
// here too. No extra requests, no build step — just the browser's own
// ledger.
//
// Caveat: a cached resource reports 0, so a warm reload reads lighter
// than a cold one. That is arguably the honest answer, but it is why
// the badge falls back to the build-time number when nothing has
// been measured yet.
// ============================================================

const FONT = /\.woff2?($|\?)/i;

function classify(entry) {
  // check the extension first: fonts pulled in by @font-face report
  // initiatorType "css", which would otherwise bucket them as stylesheets
  if (FONT.test(entry.name)) return "fonts";
  if (entry.initiatorType === "script") return "js";
  if (entry.initiatorType === "css" || entry.initiatorType === "link")
    return "css";
  return "other";
}

export function measureVisit() {
  if (typeof performance === "undefined") return null;

  const buckets = { html: 0, css: 0, js: 0, fonts: 0, other: 0 };
  let total = 0;

  const add = (kind, bytes) => {
    if (!bytes || bytes <= 0) return;
    buckets[kind] += bytes;
    total += bytes;
  };

  const nav = performance.getEntriesByType?.("navigation")?.[0];
  if (nav) add("html", nav.transferSize || nav.encodedBodySize || 0);

  for (const entry of performance.getEntriesByType?.("resource") ?? []) {
    add(classify(entry), entry.transferSize || 0);
  }

  return { total, buckets };
}
