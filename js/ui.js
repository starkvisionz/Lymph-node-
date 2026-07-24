/*
 * ui.js — DOM/UI controller. Renders the zone list, the detail panel with
 * step-by-step instructions, per-step + session timers, benefits and
 * precautions. Talks to app.js through a small callback interface so the 3D
 * scene stays decoupled from the DOM.
 */
import { ZONES, ZONE_BY_ID, SESSION_ORDER, GLOBAL_BENEFITS, PRECAUTIONS, PRINCIPLES } from "./data.js";

export class UI {
  constructor(hooks) {
    this.hooks = hooks; // { onSelectZone, onView, onStep, onStrokeStart, onStrokeStop }
    this.activeZoneId = null;
    this.stepIndex = 0;
    this.timer = null;
    this.remaining = 0;
    this.session = null; // { order, idx } when a guided full session runs
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
    this.el.startSession.addEventListener("click", () => this.startSession());
    this.el.infoBtn.addEventListener("click", () => this.openInfo());
    this.el.modalClose.addEventListener("click", () => this.el.modal.classList.remove("open"));
    this.el.modal.addEventListener("click", e => { if (e.target === this.el.modal) this.el.modal.classList.remove("open"); });

    this.renderPrecautionsBar();
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
    this.stopTimer();
    this.hooks.onStrokeStop();
    this.activeZoneId = null;
    this._syncChips();
    this.el.panel.classList.remove("open");
    this.hooks.onSelectZone(null);
  }

  /* ---------- detail panel ---------- */
  renderPanel() {
    const z = ZONE_BY_ID[this.activeZoneId];
    if (!z) return;
    const step = z.steps[this.stepIndex];
    const hex = "#" + z.color.toString(16).padStart(6, "0");

    const stepsList = z.steps.map((s, i) => `
      <li class="step ${i === this.stepIndex ? "current" : ""} ${i < this.stepIndex ? "done" : ""}"
          data-i="${i}">
        <span class="step-n">${i + 1}</span>
        <span class="step-t">${s.title}${s.reps ? ` <em>×${s.reps}</em>` : ""}</span>
        <span class="step-d">${s.duration}s</span>
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
        // auto-advance
        setTimeout(() => this.gotoStep(this.stepIndex + 1), 400);
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
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
  startSession() {
    this.session = { order: SESSION_ORDER.slice(), idx: 0 };
    this.el.startSession.classList.add("active");
    this.el.startSession.textContent = "■ Stop session";
    this.el.startSession.onclick = () => this.stopSession();
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
    this.session = null;
    this.stopTimer();
    this.el.startSession.classList.remove("active");
    this.el.startSession.textContent = "▶ Guided full session";
    this.el.startSession.onclick = () => this.startSession();
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
    this.el.modal.classList.add("open");
    if (tab === "safety") {
      requestAnimationFrame(() => document.getElementById("safety-anchor")?.scrollIntoView({ behavior: "smooth" }));
    }
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
