/*
 * voice.js — thin wrapper over the Web Speech API (SpeechSynthesis) used for
 * optional hands-free step narration. Degrades silently where the API or a
 * voice is unavailable (e.g. some headless/embedded browsers).
 */
export class Voice {
  constructor() {
    this.synth = (typeof window !== "undefined" && window.speechSynthesis) || null;
    this.available = !!this.synth;
  }

  speak(text) {
    if (!this.synth || !text) return;
    try {
      this.synth.cancel(); // never queue — always speak the current step only
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.lang = "en-US";
      this.synth.speak(u);
    } catch { /* speech is a nice-to-have */ }
  }

  cancel() {
    if (!this.synth) return;
    try { this.synth.cancel(); } catch { /* ignore */ }
  }
}
