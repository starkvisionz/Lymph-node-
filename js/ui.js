/*
 * ui.js — DOM/UI controller. Renders the zone list, the detail panel with
 * step-by-step instructions, per-step + session timers, benefits and
 * precautions. Talks to app.js through a small callback interface so the 3D
 * scene stays decoupled from the DOM.
 */
import { ZONES, ZONE_BY_ID, SESSION_ORDER, PROGRAMS, PROGRAM_BY_ID, GLOBAL_BENEFITS, PRECAUTIONS, PRINCIPLES } from "./data.js";
import { settings } from "./settings.js";
import { Voice } from "./voice.js";
import { KB, NODE_INFO } from "./knowledge.js";
import { progress } from "./progress.js";

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
      programsBtn: document.getElementById("programs-btn"),
      programsPop: document.getElementById("programs-pop"),
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
    this._buildPrograms();
    this.renderPrecautionsBar();
  }

  /* ---------- keyboard shortcuts ---------- */
  _onKeydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Escape always closes the top-most overlay, whatever has focus.
    if (e.key === "Escape") {
      if (!this.el.programsPop.hidden) { this._togglePrograms(false); this.el.programsBtn.focus(); }
      else if (!this.el.settingsPop.hidden) { this._toggleSettings(false); this.el.settingsBtn.focus(); }
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

  /* Per-zone anatomy & clinical detail, from the knowledge base. */
  _anatomyHtml(z) {
    const cards = (z.nodeIds || []).map(id => {
      const info = NODE_INFO[id];
      if (!info) return "";
      return `<div class="node-card">
        <div class="nc-head"><span class="nc-dot" style="background:#${z.color.toString(16).padStart(6, "0")}"></span>
          <strong>${info.title}</strong><span class="nc-count">${info.count}</span></div>
        <p class="nc-drains"><span>Drains</span> ${info.drains}</p>
        <p class="nc-note">${info.note}</p>
      </div>`;
    }).join("");
    if (!cards) return "";
    return `<div class="anatomy">
      <h4 class="section-label">◍ Anatomy &amp; clinical</h4>
      ${cards}
      <button type="button" class="kb-link" data-kb="nodes">Learn how lymph nodes work →</button>
    </div>`;
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

      ${this.session ? `<div class="session-banner">${this.session.program ? this.session.program.name : "Guided session"} · ${this.session.idx + 1}/${this.session.order.length} regions</div>` : ""}

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

      ${this._anatomyHtml(z)}
    `;

    this.el.panel.classList.add("open");

    // Wire step controls
    this.el.timer = document.getElementById("timer");
    document.getElementById("btn-prev").addEventListener("click", () => this.gotoStep(this.stepIndex - 1));
    document.getElementById("btn-next").addEventListener("click", () => this.gotoStep(this.stepIndex + 1));
    document.getElementById("btn-play").addEventListener("click", () => this.toggleStepTimer());
    this.el.panelBody.querySelectorAll(".step").forEach(li =>
      li.addEventListener("click", () => this.gotoStep(parseInt(li.dataset.i, 10))));
    this.el.panelBody.querySelector(".kb-link")
      ?.addEventListener("click", e => this.openKnowledge(e.currentTarget.dataset.kb));

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

  startSession(program) {
    const p = program || PROGRAM_BY_ID.full;
    this.session = { order: p.order.slice(), idx: 0, program: { id: p.id, name: p.name } };
    this.el.startSession.classList.add("active");
    this.el.startSession.textContent = "■ Stop session";
    this._togglePrograms(false);
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
    const prog = this.session && this.session.program;
    this.resetSessionState();
    if (completed) {
      if (prog) { progress.record(prog.id, prog.name); this._refreshPrograms(); }
      this._toast(`${prog ? prog.name : "Session"} complete — great work. Hydrate! 💧`);
    }
  }

  /* ---------- targeted programs picker ---------- */
  _buildPrograms() {
    this.el.programsBtn.addEventListener("click", () => this._togglePrograms());
    document.addEventListener("click", e => {
      if (this.el.programsPop.hidden) return;
      if (!this.el.programsPop.contains(e.target) && e.target !== this.el.programsBtn) this._togglePrograms(false);
    });
    this._refreshPrograms();
  }

  _refreshPrograms() {
    const total = progress.total(), streak = progress.streak();
    const head = total
      ? `<div class="pp-head">You've completed <strong>${total}</strong> session${total === 1 ? "" : "s"}${streak > 1 ? ` · 🔥 ${streak}-day streak` : ""}</div>`
      : `<div class="pp-head">Pick a routine for your goal — each opens the drains first.</div>`;
    const items = PROGRAMS.map(p => {
      const c = progress.countFor(p.id);
      return `<button type="button" class="pp-item" role="menuitem" data-prog="${p.id}">
        <span class="pp-top"><strong>${p.name}</strong><span class="pp-tag">${p.tag}</span></span>
        <span class="pp-goal">${p.goal}</span>
        ${c ? `<span class="pp-count" title="Completed ${c} time${c === 1 ? "" : "s"}">✓ ${c}</span>` : ""}
      </button>`;
    }).join("");
    this.el.programsPop.innerHTML = head + items;
    this.el.programsPop.querySelectorAll(".pp-item").forEach(b =>
      b.addEventListener("click", () => this.startSession(PROGRAM_BY_ID[b.dataset.prog])));
  }

  _togglePrograms(force) {
    const open = force !== undefined ? force : this.el.programsPop.hidden;
    this.el.programsPop.hidden = !open;
    this.el.programsBtn.setAttribute("aria-expanded", String(open));
    if (open) requestAnimationFrame(() => this.el.programsPop.querySelector(".pp-item")?.focus());
  }

  /* ---------- info / safety modal ---------- */
  // Back-compat entry point; opens the knowledge hub at a given tab.
  openInfo(tab) { this.openKnowledge(typeof tab === "string" ? tab : "overview"); }

  openKnowledge(tab = "overview") {
    const tabs = [
      ["overview", "How it works"],
      ["nodes", "Lymph nodes 101"],
      ["system", "The system"],
      ["regions", "Node regions"],
      ["swollen", "Swollen nodes"],
      ["faq", "FAQ"],
      ["glossary", "Glossary"],
      ["safety", "Safety"],
    ];
    const rail = tabs.map(([id, label]) =>
      `<button class="kb-tab${id === "safety" ? " warn" : ""}" role="tab" data-tab="${id}">${label}</button>`).join("");

    this.el.modalBody.innerHTML = `
      <div class="kb">
        <nav class="kb-rail" role="tablist" aria-label="Knowledge base">${rail}</nav>
        <div class="kb-content" id="kb-content" role="tabpanel" tabindex="0"></div>
      </div>`;

    const setTab = id => {
      this.el.modalBody.querySelectorAll(".kb-tab").forEach(b =>
        b.classList.toggle("active", b.dataset.tab === id));
      const content = document.getElementById("kb-content");
      content.innerHTML = this._kbTab(id);
      content.scrollTop = 0;
    };
    this.el.modalBody.querySelectorAll(".kb-tab").forEach(b =>
      b.addEventListener("click", () => setTab(b.dataset.tab)));
    setTab(tabs.some(t => t[0] === tab) ? tab : "overview");

    this._lastFocus = document.activeElement;
    this.el.modal.classList.add("open");
    this._trapHandler = e => this._trapFocus(e);
    this.el.modal.addEventListener("keydown", this._trapHandler);
    requestAnimationFrame(() => this.el.modalClose.focus());
  }

  _kbTab(id) {
    if (id === "overview") {
      const principles = PRINCIPLES.map(p => `<li><strong>${p.title}.</strong> ${p.text}</li>`).join("");
      const benefits = GLOBAL_BENEFITS.map(b => `<li>${b}</li>`).join("");
      return `
        <h2>How lymphatic drainage works</h2>
        <p class="lead">Your lymphatic system is a one-way network of tiny vessels carrying fluid,
        waste and immune cells from your tissues back to the bloodstream. It has no central pump — it
        relies on muscle movement, breathing and gentle skin stretching. Manual Lymphatic Drainage
        (MLD) uses very light, rhythmic strokes to encourage that flow toward the nodes and out at
        the collarbones.</p>
        <h3>The 5 principles</h3>
        <ol class="principles">${principles}</ol>
        <h3>General benefits</h3>
        <ul class="bul">${benefits}</ul>`;
    }
    if (id === "nodes") return `<h2>${KB.nodes.title}</h2><p class="lead">${KB.nodes.lead}</p>${KB.nodes.html}`;
    if (id === "system") return `<h2>${KB.system.title}</h2><p class="lead">${KB.system.lead}</p>${KB.system.html}`;
    if (id === "regions") {
      const rows = KB.regions.table.map(([r, d, t]) =>
        `<tr><th scope="row">${r}</th><td>${d}</td><td class="kb-flow">${t}</td></tr>`).join("");
      return `<h2>${KB.regions.title}</h2><p class="lead">${KB.regions.lead}</p>
        <div class="kb-table-wrap"><table class="kb-table">
          <thead><tr><th>Cluster</th><th>Drains</th><th>Flows to</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`;
    }
    if (id === "swollen") return `<h2>${KB.swollen.title}</h2><p class="lead">${KB.swollen.lead}</p>${KB.swollen.html}`;
    if (id === "faq") {
      const items = KB.faq.items.map(([q, a]) =>
        `<details class="kb-faq"><summary>${q}</summary><p>${a}</p></details>`).join("");
      return `<h2>${KB.faq.title}</h2>${items}`;
    }
    if (id === "glossary") {
      const items = KB.glossary.items.map(([t, d]) =>
        `<div class="kb-term"><dt>${t}</dt><dd>${d}</dd></div>`).join("");
      return `<h2>${KB.glossary.title}</h2><dl class="kb-glossary">${items}</dl>`;
    }
    // safety
    const prec = PRECAUTIONS.map(p => `
      <li class="prec ${p.level}">
        <span class="prec-ico">${p.level === "stop" ? "⛔" : p.level === "care" ? "⚠︎" : "•"}</span>
        <span><strong>${p.title}.</strong> ${p.text}</span>
      </li>`).join("");
    return `
      <h2 class="warn">⚠︎ Safety &amp; contraindications</h2>
      <p>MLD is gentle, but it is not for everyone. <strong>When in doubt, ask a doctor or a certified
      lymphedema therapist.</strong></p>
      <ul class="prec-list">${prec}</ul>
      <p class="disclaimer">This guide is for general education only and is not medical advice,
      diagnosis or treatment. If you have swelling that is new, one-sided, painful, hot or red — or
      any diagnosed medical condition — seek professional care before self-massaging.</p>`;
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
