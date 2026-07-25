# Lymph Flow — 3D Lymphatic Drainage Massage Guide

An interactive, **massage-focused** 3D guide to manual lymphatic drainage (MLD)
self-massage. Not a mannequin with a few glowing dots — it models the actual
lymphatic network and teaches *where* to stroke, *which direction*, *how hard*,
*in what order*, and *when not to*.

![Lymph Flow overview](assets/favicon.svg)

## What it does

- **Translucent 3D figure** you can rotate freely, with one-tap **Front / Back**
  views. Selecting a region auto-rotates the model to the face that shows it.
- **Anatomical node clusters** — cervical/terminus, submandibular, axillary,
  cubital, cisterna chyli, inguinal, plus posterior clusters (occipital,
  interscapular, lumbar, popliteal) — glowing and clickable, with hover labels.
- **Animated drainage vessels.** Particles flow along each pathway in the true
  lymph direction (distal → terminus), which is exactly the direction you stroke.
  Selecting a zone highlights its pathways and dims the rest.
- **Stroke-direction indicator.** A moving arrow demonstrates the current step's
  stroke along the correct pathway.
- **8 drainage zones** with step-by-step MLD sequences: Neck Terminus, Neck &
  Cervical Chain, Armpit (Axillary), Arm, Abdomen & Breathing, Groin (Inguinal),
  Leg, and Back (Posterior).
- **Timers.** Each step has a countdown timer that auto-advances; or run a
  **Guided full session** that walks the whole body in the correct order
  (drains first, then the limbs that feed them).
- **Benefits & precautions** per region, plus a full **How it works** panel with
  the 5 MLD principles and a prominent **safety / contraindications** list.
- **Hands-free & accessible** — optional **voice guidance** speaks each step aloud
  (Web Speech API), keyboard shortcuts (**1–8** zones, **Space** play/pause,
  **N/P** next/prev, **Esc** close), and a **Settings** popover (voice, sound,
  and an animation control incl. reduce/pause) persisted to `localStorage`.
  Dialogs trap and restore focus; `prefers-reduced-motion` is honoured.
- **Knowledge base** — a tabbed **Learn** hub: how MLD works, *Lymph nodes 101*
  (with an SVG node cross-section), the lymphatic system, a node-region drainage
  reference, guidance on swollen nodes & red flags, an FAQ and a glossary. Every
  drainage zone also carries an **Anatomy & clinical** section detailing each
  node cluster it targets (what it drains, node counts, clinical notes).

## Run it

It's a static site — no build step.

```bash
# any static server, e.g.
npx http-server . -p 8123
# then open http://localhost:8123
```

Or just open `index.html` through a local server (ES modules require `http://`,
not `file://`).

## Project structure

```
index.html            # shell, import map, layout
css/styles.css        # clinical/glassmorphism theme, responsive
js/data.js            # anatomy + MLD content (single source of truth)
js/body.js            # builds the 3D figure, nodes, vessels, demo visuals
js/app.js             # scene, camera, raycasting, animation loop
js/ui.js              # panels, steps, timers, guided session, safety modal
js/settings.js        # user preferences (voice/sound/motion), localStorage
js/voice.js           # Web Speech (SpeechSynthesis) wrapper for narration
js/knowledge.js       # knowledge base: node anatomy, system, regions, FAQ, glossary
vendor/three/         # Three.js r160 (vendored, so it works fully offline)
assets/favicon.svg
```

Three.js is **vendored locally** (MIT-licensed, header retained) so the guide
runs with no CDN and no network access.

## Adding or editing content

Everything the app renders comes from `js/data.js`:

- `NODES` — node clusters (`pos`, `size`, `side`, `view`). `side: 1` auto-mirrors
  to both sides of the body.
- `PATHWAYS` — ordered point lists from **distal → terminus**; flow and stroke
  arrows follow this order.
- `ZONES` — the interactive regions, each with `steps` (title, instruction,
  `duration` for the timer, `reps`, and an optional `strokePath`), `benefits`
  and `precautions`.
- `PRECAUTIONS`, `GLOBAL_BENEFITS`, `PRINCIPLES` — the safety/education content.

## ⚠️ Medical disclaimer

This guide is for **general education only** and is **not** medical advice,
diagnosis, or treatment. Manual lymphatic drainage is contraindicated in several
conditions (active infection/fever, DVT or suspected blood clots, congestive
heart or kidney failure, and others — see the in-app safety panel). If you have
new, one-sided, painful, hot, or red swelling, an undiagnosed lump, or any
diagnosed medical condition, consult a physician or a certified lymphedema
therapist before self-massaging.
