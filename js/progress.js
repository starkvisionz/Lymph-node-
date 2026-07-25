/*
 * progress.js — lightweight session-history store (localStorage). Records how
 * many times each program has been completed, the running total, a simple
 * day-streak, and the last program finished. Personalises the Programs picker.
 */
const KEY = "lymphflow.progress.v1";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
function today() { return new Date().toISOString().slice(0, 10); } // YYYY-MM-DD
function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export const progress = {
  total() { return load().total || 0; },
  countFor(id) { const p = load(); return (p.programs && p.programs[id]) || 0; },
  streak() { return load().streak || 0; },
  last() { return load().last || null; },

  /* Record one completed program run. Returns the updated snapshot. */
  record(programId, name) {
    const p = load();
    p.total = (p.total || 0) + 1;
    p.programs = p.programs || {};
    p.programs[programId] = (p.programs[programId] || 0) + 1;

    const day = today();
    if (p.lastDay) {
      const gap = daysBetween(p.lastDay, day);
      if (gap === 1) p.streak = (p.streak || 0) + 1;
      else if (gap > 1) p.streak = 1;
      // gap === 0 (same day) leaves the streak unchanged
      else if (!p.streak) p.streak = 1;
    } else {
      p.streak = 1;
    }
    p.lastDay = day;
    p.last = { id: programId, name, at: day };
    save(p);
    return p;
  }
};
