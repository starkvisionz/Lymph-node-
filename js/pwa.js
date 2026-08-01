/*
 * pwa.js — progressive-web-app glue: registers the service worker, wires the
 * "Install app" button (via beforeinstallprompt), and shows the app version.
 * All of it degrades gracefully where the APIs aren't available.
 */
import { VERSION } from "./version.js";

const versionEl = document.getElementById("app-version");
if (versionEl) versionEl.textContent = `Lymph Flow · v${VERSION}`;

// Register the offline service worker.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => { /* offline support is optional */ });
  });
}

// Custom install affordance (Chromium-based browsers).
let deferredPrompt = null;
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});

installBtn?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { await deferredPrompt.userChoice; } catch { /* ignore */ }
  deferredPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => { if (installBtn) installBtn.hidden = true; });
