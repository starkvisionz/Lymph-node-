/*
 * ui.js — DOM/UI controller. Renders the zone list, the detail panel with
 * step-by-step instructions, per-step + session timers, benefits and
 * precautions. Talks to app.js through a small callback interface so the 3D
 * scene stays decoupled from the DOM.
 */
import { ZONES, ZONE_BY_ID, SESSION_ORDER, GLOBAL_BENEFITS, PRECAUTIONS, PRINCIPLES } from "./data.js";
import { settings } from "./settings.js";
import { Voice } from "./voice.js";

export class UI {
  constructor(hooks) {
    this.hooks = hooks; // { onSelectZone, onView, onStep, onStrokeStart, onStrokeStop }
    this.activeZoneId = null;
    this.stepIndex = 0;
    this.timer = null;
    this.autoAdvanceTimeout = null; // pending step auto-advance (cleared on stop)
    this.remaining = 0;
    this.session = null; // { order, idx } when a guided full session runs
    this._lastFocus = null; // restored when the modal closes
    this._trapHandler = null;
    this.voice = new Voice();
    this._voiceTipShown = false;
    this._build();
  }

  /* ---------- DOM scaffolding ---------- */
  _build() {
    this.el = {
      zoneList: document.getElementById("zone-list"),
      panel: document.getElementById("detail-panel"),
      panelBody: document.getElementById("panel-body"),
      panelClose: document.getElementById("panel-close"),
      viewFront: document.getElementById("view-front"),
      viewBack: document.getElementById("view-back"),
      viewReset: document.getElementById("view-reset"),
      startSession: document.getElementById("start-session"),
      infoBtn: document.getElementById("info-btn"),
      modal: document.getElementById("modal"),
      modalBody: document.getElementById("modal-body"),
      modalClose: document.getElementById("modal-close"),
      hint: document.getElementById("hint"),
      settingsBtn: document.getElementById("settings-btn"),
      settingsPop: document.getElementById("settings-pop"),
      setVoice: document.getElementById("set-voice"),
      setSound: document.getElementById("set-sound"),
      motionAuto: document.getElementById("motion-auto"),
      motionOff: document.getElementById("motion-off"),
      motionOn: document.getElementById("motion-on"),
      voiceUnavailable: document.getElementById("voice-unavailable"),
    };

    // Zone chips
    this.el.zoneList.innerHTML = "";
    ZONES.forEach(z => {
      const b = document.createElement("button");
      b.className = "zone-chip";
      b.dataset.id = z.id;
      b.innerHTML = `<span class="dot" style="background:#${z.color.toString(16).padStart(6, "0")}"></span>
        <span class="zc-text"><strong>${z.name}</strong><em>${z.tag}</em></span>`;
      b.addEventListener("click", () => this.selectZone(z.id, true));
      this.el.zoneList.appendChild(b);
    });

    this.el.panelClose.addEventListener("click", () => this.closePanel());
    this.el.viewFront.addEventListener("click", () => { this.hooks.onView("front"); this._setViewSeg("front"); });
    this.el.viewBack.addEventListener("click", () => { this.hooks.onView("back"); this._setViewSeg("back"); });
    this.el.viewReset.addEventListener("click", () => { this.hooks.onView("reset"); this._setViewSeg("front"); });
    // Single guided-session handler that toggles on the current state, so the
    // permanent listener and per-state logic never both fire from one click.
    this.el.startSession.addEventListener("click", () => {
      if (this.session) this.stopSession(); else this.startSession();
    });
    this.el.infoBtn.addEventListener("click", () => this.openInfo());
    this.el.modalClose.addEventListener("click", () => this.closeModal());
    this.el.modal.addEventListener("click", e => { if (e.target === this.el.modal) this.closeModal(); });

    document.addEventListener("keydown", e => this._onKeydown(e));
    this._buildSettings();
    this.renderPrecautionsBar();
  }

  /* ---------- keyboard shortcuts ---------- */
  _onKeydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Escape always closes the top-most overlay, whatever has focus.
    if (e.key === "Escape") {
      if (!this.el.settingsPop.hidden) { this._toggleSettings(false); this.el.settingsBtn.focus(); }
      else if (this.el.modal.classList.contains("open")) this.closeModal();
      else if (this.el.panel.classList.contains("open")) this.closePanel();
      return;
    }
    // All other shortcuts must never hijack typing / form controls.
    const tag = (e.target && e.target.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    // 1–8 jump to a zone
    if (/^[1-8]$/.test(e.key)) {
      const z = ZONES[parseInt(e.key, 10) - 1];
      if (z) { this.selectZone(z.id, true); this.el.zoneList.querySelector(`.zone-chip[data-id="${z.id}"]`)?.focus(); }
      return;
    }
    // Step controls only make sense with an open panel
    if (!this.el.panel.classList.contains("open")) return;
    if (e.key === " " || e.code === "Space") { e.preventDefault(); this.toggleStepTimer(); }
    else if (e.key === "n" || e.key === "N") { this.gotoStep(this.stepIndex + 1); }
    else if (e.key === "p" || e.key === "P") { this.gotoStep(this.stepIndex - 1); }
  }

  /* ---------- settings popover ---------- */
  _buildSettings() {
    const s = this.el;
    // Voice availability
    if (!this.voice.available) {
      s.setVoice.checked = false;
      s.setVoice.disabled = true;
      s.voiceUnavailable.hidden = false;
    } else {
      s.setVoice.checked = !!settings.get("voice");
    }
    s.setSound.checked = !!settings.get("sound");
    const motion = settings.get("motion");
    ({ auto: s.motionAuto, off: s.motionOff, on: s.motionOn })[motion].checked = true;

    s.settingsBtn.addEventListener("click", () => this._toggleSettings());
    s.setVoice.addEventListener("change", () => {
      settings.set("voice", s.setVoice.checked);
      if (s.setVoice.checked) this._speakCurrentStep(); else this.voice.cancel();
    });
    s.setSound.addEventListener("change", () => settings.set("sound", s.setSound.checked));
    [["auto", s.motionAuto], ["off", s.motionOff], ["on", s.motionOn]].forEach(([val, el]) =>
      el.addEventListener("change", () => { if (el.checked) settings.set("motion", val); }));

    // Close on outside click
    document.addEventListener("click", e => {
      if (this.el.settingsPop.hidden) return;
      if (!this.el.settingsPop.contains(e.target) && e.target !== this.el.settingsBtn) this._toggleSettings(false);
    });
  }

  _toggleSettings(force) {
    const open = force !== undefined ? force : this.el.settingsPop.hidden;
    this.el.settingsPop.hidden = !open;
    this.el.settingsBtn.setAttribute("aria-expanded", String(open));
    if (open) requestAnimationFrame(() => this.el.settingsPop.querySelector("input")?.focus());
  }

  /* ---------- precaution banner ---------- */
  renderPrecautionsBar() {
    const bar = document.getElementById("precaution-bar");
    const stop = PRECAUTIONS.filter(p => p.level === "stop").map(p => p.title).join(" · ");
    bar.innerHTML = `<span class="warn-ico">⚠︎</span> <strong>Do not massage if:</strong> ${stop}.
      <button id="precaution-more" class="link">Full safety &amp; contraindications →</button>`;
    document.getElementById("precaution-more").addEventListener("click", () => this.openInfo("safety"));
  }

  /* ---------- zone selection ---------- */
  selectZone(id, fromClick) {
    if (this.session && fromClick) this.stopSession();
    this.activeZoneId = id;
    this.stepIndex = 0;
    this._syncChips();
    this.renderPanel();
    this.hooks.onSelectZone(id);
    // Auto-rotate the model to the face that best shows this region.
    const z = ZONE_BY_ID[id];
    if (z) { const v = z.view === "back" ? "back" : "front"; this.hooks.onView(v); this._setViewSeg(v); }
    this.el.hint.classList.add("hidden");
  }

  _setViewSeg(which) {
    this.el.viewFront.classList.toggle("active", which === "front");
    this.el.viewBack.classList.toggle("active", which === "back");
  }

  _syncChips() {
    [...this.el.zoneList.children].forEach(c =>
      c.classList.toggle("active", c.dataset.id === this.activeZoneId));
  }

  closePanel() {
    this.resetSessionState(); // also stops timers / pending auto-advance
    this.voice.cancel();
    this.hooks.onStrokeStop();
    this.activeZoneId = null;
    this._syncChips();
    this.el.panel.classList.remove("open");
    this.hooks.onSelectZone(null);
  }

  /* Speak the active step when voice guidance is enabled. */
  _speakCurrentStep() {
    if (!settings.get("voice") || !this.voice.available) return;
    const z = ZONE_BY_ID[this.activeZoneId];
    if (!z) return;
    const step = z.steps[this.stepIndex];
    if (step) this.voice.speak(`${step.title}. ${step.instruction}`);
  }

  /* ---------- detail panel ---------- */
  renderPanel() {
    const z = ZONE_BY_ID[this.activeZoneId];
    if (!z) return;
    const step = z.steps[this.stepIndex];
    const hex = "#" + z.color.toString(16).padStart(6, "0");

    const stepsList = z.steps.map((s, i) => `
      <li class="step-li">
        <button type="button" class="step ${i === this.stepIndex ? "current" : ""} ${i < this.stepIndex ? "done" : ""}"
          data-i="${i}" aria-current="${i === this.stepIndex ? "step" : "false"}">
          <span class="step-n">${i + 1}</span>
          <span class="step-t">${s.title}${s.reps ? ` <em>×${s.reps}</em>` : ""}</span>
          <span class="step-d">${s.duration}s</span>
        </button>
      </li>`).join("");

    this.el.panelBody.innerHTML = `
      <div class="panel-head" style="--accent:${hex}">
        <div class="ph-tag">${z.tag}</div>
        <h2>${z.name}</h2>
        <p class="summary">${z.summary}</p>
      </div>

      ${this.session ? `<div class="session-banner">Guided session · ${this.session.idx + 1}/${this.session.order.length} regions</div>` : ""}

      <div class="step-active" style="--accent:${hex}">
        <div class="sa-top">
          <span class="sa-label">Step ${this.stepIndex + 1} of ${z.steps.length}</span>
          <div class="timer" id="timer">${this._fmt(step.duration)}</div>
        </div>
        <h3 id="sa-title">${step.title}${step.reps ? ` · ×${step.reps}` : ""}</h3>
        <p id="sa-instruction">${step.instruction}</p>
        <div class="controls">
          <button id="btn-prev" class="ctrl" ${this.stepIndex === 0 ? "disabled" : ""}>‹ Prev</button>
          <button id="btn-play" class="ctrl primary">▶ Start step</button>
          <button id="btn-next" class="ctrl">${this.stepIndex === z.steps.length - 1 ? "Finish ›" : "Next ›"}</button>
        </div>
      </div>

      <ol class="steps">${stepsList}</ol>

      <div class="cols">
        <div class="col">
          <h4>✦ Benefits</h4>
          <ul class="bul">${z.benefits.map(b => `<li>${b}</li>`).join("")}</ul>
        </div>
        <div class="col">
          <h4 class="warn">⚠︎ Watch out</h4>
          <ul class="bul warn">${z.precautions.map(b => `<li>${b}</li>`).join("")}</ul>
        </div>
      </div>
    `;

    this.el.panel.classList.add("open");

    // Wire step controls
    this.el.timer = document.getElementById("timer");
    document.getElementById("btn-prev").addEventListener("click", () => this.gotoStep(this.stepIndex - 1));
    document.getElementById("btn-next").addEventListener("click", () => this.gotoStep(this.stepIndex + 1));
    document.getElementById("btn-play").addEventListener("click", () => this.toggleStepTimer());
    this.el.panelBody.querySelectorAll(".step").forEach(li =>
      li.addEventListener("click", () => this.gotoStep(parseInt(li.dataset.i, 10))));

    // Kick the stroke animation for this step
    this.hooks.onStep(z, step);
    // Narrate the step when hands-free voice guidance is on
    this._speakCurrentStep();
  }

  gotoStep(i) {
    const z = ZONE_BY_ID[this.activeZoneId];
    if (!z) return;
    this.stopTimer();
    if (i < 0) i = 0;
    if (i >= z.steps.length) {
      // End of region
      if (this.session) return this.advanceSession();
      i = z.steps.length - 1;
      this.stepIndex = i;
      this.renderPanel();
      this._flashDone();
      return;
    }
    this.stepIndex = i;
    this.renderPanel();
  }

  /* ---------- per-step timer ---------- */
  toggleStepTimer() {
    if (this.timer) { this.stopTimer(); return; }
    const z = ZONE_BY_ID[this.activeZoneId];
    const step = z.steps[this.stepIndex];
    this.remaining = step.duration;
    this._setPlay(true);
    this._updateTimerLabel();
    this.timer = setInterval(() => {
      this.remaining -= 1;
      this._updateTimerLabel();
      if (this.remaining <= 0) {
        this.stopTimer();
        this._beep();
        // auto-advance (tracked so it can be cancelled if the user stops/exits)
        this.autoAdvanceTimeout = setTimeout(() => {
          this.autoAdvanceTimeout = null;
          this.gotoStep(this.stepIndex + 1);
        }, 400);
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.autoAdvanceTimeout) { clearTimeout(this.autoAdvanceTimeout); this.autoAdvanceTimeout = null; }
    this._setPlay(false);
  }

  _setPlay(running) {
    const btn = document.getElementById("btn-play");
    if (btn) {
      btn.textContent = running ? "❚❚ Pause" : "▶ Start step";
      btn.classList.toggle("running", running);
    }
  }

  _updateTimerLabel() {
    const t = document.getElementById("timer");
    if (t) t.textContent = this._fmt(Math.max(0, this.remaining));
  }

  /* ---------- guided full session ---------- */
  // One shared teardown for all session exits (manual zone pick, stop button,
  // panel close, completion) — no duplicated reset logic, no stray timers.
  resetSessionState() {
    this.stopTimer(); // clears interval + pending auto-advance + play button
    this.voice.cancel();
    this.session = null;
    this.el.startSession.classList.remove("active");
    this.el.startSession.textContent = "▶ Guided full session";
  }

  startSession() {
    this.session = { order: SESSION_ORDER.slice(), idx: 0 };
    this.el.startSession.classList.add("active");
    this.el.startSession.textContent = "■ Stop session";
    // Nudge first-timers toward hands-free mode (once per page load).
    if (this.voice.available && !settings.get("voice") && !this._voiceTipShown) {
      this._voiceTipShown = true;
      this._toast("Tip: enable 🔊 Voice guidance in ⚙ Settings for hands-free steps.");
    }
    this.selectZone(this.session.order[0], false);
  }

  advanceSession() {
    if (!this.session) return;
    this.session.idx += 1;
    if (this.session.idx >= this.session.order.length) {
      this.stopSession(true);
      return;
    }
    const id = this.session.order[this.session.idx];
    this.selectZone(id, false);
  }

  stopSession(completed) {
    this.resetSessionState();
    if (completed) this._toast("Session complete — great work. Hydrate! 💧");
  }

  /* ---------- info / safety modal ---------- */
  openInfo(tab) {
    const principles = PRINCIPLES.map(p => `<li><strong>${p.title}.</strong> ${p.text}</li>`).join("");
    const benefits = GLOBAL_BENEFITS.map(b => `<li>${b}</li>`).join("");
    const prec = PRECAUTIONS.map(p => `
      <li class="prec ${p.level}">
        <span class="prec-ico">${p.level === "stop" ? "⛔" : p.level === "care" ? "⚠︎" : "•"}</span>
        <span><strong>${p.title}.</strong> ${p.text}</span>
      </li>`).join("");

    this.el.modalBody.innerHTML = `
      <h2>How lymphatic drainage massage works</h2>
      <p class="lead">Your lymphatic system is a one-way network of tiny vessels that carries fluid,
      waste and immune cells from your tissues back to the bloodstream. It has no central pump —
      it relies on muscle movement, breathing and gentle skin stretching. Manual Lymphatic Drainage
      (MLD) uses very light, rhythmic strokes to encourage that flow toward the nodes and out at the
      collarbones.</p>

      <h3>The 5 principles</h3>
      <ol class="principles">${principles}</ol>

      <h3>General benefits</h3>
      <ul class="bul">${benefits}</ul>

      <h3 id="safety-anchor" class="warn">⚠︎ Safety &amp; contraindications</h3>
      <p>MLD is gentle, but it is not for everyone. <strong>When in doubt, ask a doctor or a certified
      lymphedema therapist.</strong></p>
      <ul class="prec-list">${prec}</ul>

      <p class="disclaimer">This guide is for general education only and is not medical advice,
      diagnosis or treatment. If you have swelling that is new, one-sided, painful, hot or red — or
      any diagnosed medical condition — seek professional care before self-massaging.</p>
    `;
    this._lastFocus = document.activeElement;
    this.el.modal.classList.add("open");
    // Trap focus inside the dialog and move focus to the close button.
    this._trapHandler = e => this._trapFocus(e);
    this.el.modal.addEventListener("keydown", this._trapHandler);
    requestAnimationFrame(() => {
      this.el.modalClose.focus();
      if (tab === "safety") document.getElementById("safety-anchor")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  closeModal() {
    if (!this.el.modal.classList.contains("open")) return;
    this.el.modal.classList.remove("open");
    if (this._trapHandler) {
      this.el.modal.removeEventListener("keydown", this._trapHandler);
      this._trapHandler = null;
    }
    if (this._lastFocus && typeof this._lastFocus.focus === "function") this._lastFocus.focus();
  }

  _trapFocus(e) {
    if (e.key !== "Tab") return;
    const focusable = [...this.el.modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- misc ---------- */
  _fmt(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }
  _flashDone() { this._toast("Region done ✓"); }
  _toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove("show"), 2600);
  }
  _beep() {
    if (!settings.get("sound")) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 660; o.type = "sine";
      g.gain.value = 0.05;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.15);
      setTimeout(() => ctx.close(), 300);
    } catch (e) { /* audio optional */ }
  }
}
