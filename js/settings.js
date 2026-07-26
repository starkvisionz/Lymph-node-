/*
 * settings.js — tiny user-preferences store, persisted to localStorage, with a
 * pub/sub so both the UI and the 3D scene react to changes.
 *
 * Keys:
 *   voice  : boolean  — speak step titles/instructions (hands-free guidance)
 *   sound  : boolean  — play the short completion cues
 *   motion : "auto" | "on" | "off"
 *              auto = follow the OS prefers-reduced-motion setting
 *              on   = force reduced motion (pause animations)
 *              off  = force full motion
 */
const KEY = "lymphflow.settings.v1";
const DEFAULTS = { voice: false, sound: true, motion: "auto" };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

let state = load();
const listeners = new Set();

export const settings = {
  get(k) { return state[k]; },
  all() { return { ...state }; },
  set(k, v) {
    if (state[k] === v) return;
    state[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
    listeners.forEach(fn => { try { fn(k, v, state); } catch { /* isolate */ } });
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};
