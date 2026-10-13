// ============================================================
// time of day
//
// The room changes with the hour: a warm wash at dawn, a cool
// clear light through the day, a magenta dusk, and a deep
// violet night. It is one fixed overlay, and its colour is mixed
// from the *theme's own* accents (see app.css), so it retints
// with the palette rather than fighting it — change the theme
// and the light changes with it.
//
// The phase is a plain function of the visitor's own clock,
// refreshed on a timer and whenever the tab comes back, so a
// page left open overnight wakes up in the right light.
// ============================================================

// local hours, not utc. the boundaries are soft — this is a mood,
// not a schedule.
export function phaseOf(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

// reactive, so the footer can name the light and App can paint it
export const tod = $state({ phase: phaseOf() });

export function refresh() {
  const next = phaseOf();
  if (next !== tod.phase) tod.phase = next;
}

// returns a cleanup. a minute is plenty — the phase changes on the
// hour, and the timer is cheap.
export function startTimeOfDay() {
  refresh();
  const t = setInterval(refresh, 60000);
  const onShow = () => refresh();
  document.addEventListener("visibilitychange", onShow);
  window.addEventListener("focus", onShow);
  return () => {
    clearInterval(t);
    document.removeEventListener("visibilitychange", onShow);
    window.removeEventListener("focus", onShow);
  };
}
