import { test, expect } from "@playwright/test";
import { ZONES } from "../js/data.js";

// Collect console errors + failed requests for every test.
function attachDiagnostics(page) {
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("requestfailed", r => errors.push("requestfailed: " + r.url()));
  return errors;
}

async function bootReady(page) {
  await page.goto("/index.html");
  await expect(page.locator("#loader")).toHaveClass(/hidden/, { timeout: 15000 });
}

test.describe("Lymph Flow", () => {
  test("boots with no JS errors or failed asset requests", async ({ page }) => {
    const errors = attachDiagnostics(page);
    await bootReady(page);
    // ignore favicon-style benign 404s if any slip in on some browsers
    const real = errors.filter(e => !/favicon/i.test(e));
    expect(real, real.join("\n")).toEqual([]);
    await expect(page.locator(".zone-chip")).toHaveCount(ZONES.length);
  });

  test("every drainage zone opens its step panel", async ({ page }) => {
    test.slow(); // iterates all 8 zones — give slower CI runners headroom
    await bootReady(page);
    for (const z of ZONES) {
      await page.click(`.zone-chip[data-id="${z.id}"]`);
      await expect(page.locator("#detail-panel")).toHaveClass(/open/);
      await expect(page.locator("#sa-title")).not.toHaveText("");
      // step count matches the data
      await expect(page.locator(".step")).toHaveCount(z.steps.length);
      // Close between zones: the realistic flow, and it keeps the mobile
      // zone-chip strip unobstructed by the bottom-sheet panel.
      await page.keyboard.press("Escape");
      await expect(page.locator("#detail-panel")).not.toHaveClass(/open/);
    }
  });

  test("front / back / reset views update the toggle", async ({ page }) => {
    await bootReady(page);
    await page.click("#view-back");
    await expect(page.locator("#view-back")).toHaveClass(/active/);
    await page.click("#view-front");
    await expect(page.locator("#view-front")).toHaveClass(/active/);
    await page.click("#view-reset");
    await expect(page.locator("#view-front")).toHaveClass(/active/); // reset == front-facing
  });

  test("selecting a posterior zone auto-rotates to the back", async ({ page }) => {
    await bootReady(page);
    await page.click('.zone-chip[data-id="back"]');
    await expect(page.locator("#view-back")).toHaveClass(/active/);
  });

  test("per-step timer starts, counts down, pauses and advances", async ({ page }) => {
    await bootReady(page);
    await page.click('.zone-chip[data-id="leg"]');
    const before = await page.locator("#timer").textContent();
    await page.click("#btn-play");
    await expect(page.locator("#btn-play")).toContainText("Pause");
    await page.waitForTimeout(1600);
    const after = await page.locator("#timer").textContent();
    expect(after).not.toEqual(before); // counted down
    await page.click("#btn-play"); // pause
    await expect(page.locator("#btn-play")).toContainText("Start step");
    // Next advances the step
    const t1 = await page.locator("#sa-title").textContent();
    await page.click("#btn-next");
    const t2 = await page.locator("#sa-title").textContent();
    expect(t2).not.toEqual(t1);
    // Steps are keyboard-focusable buttons
    await expect(page.locator("li.step-li button.step").first()).toBeVisible();
  });

  test("guided session starts, stops, and restarts cleanly (no handler conflict)", async ({ page }) => {
    await bootReady(page);
    // start
    await page.click("#start-session");
    await expect(page.locator(".session-banner")).toContainText("1/8");
    await expect(page.locator("#start-session")).toContainText("Stop session");
    // stop
    await page.click("#start-session");
    await expect(page.locator("#start-session")).toContainText("Guided full session");
    // restart works after stopping (would break if addEventListener + onclick both fired)
    await page.click("#start-session");
    await expect(page.locator(".session-banner")).toContainText("1/8");
    await expect(page.locator("#start-session")).toContainText("Stop session");
  });

  test("manually selecting a zone exits guided-session mode", async ({ page }) => {
    await bootReady(page);
    await page.click("#start-session");
    await expect(page.locator(".session-banner")).toBeVisible();
    await page.click('.zone-chip[data-id="arm"]');
    await expect(page.locator(".session-banner")).toHaveCount(0);
    await expect(page.locator("#start-session")).toContainText("Guided full session");
  });

  test("modal opens/closes by mouse and keyboard, and restores focus", async ({ page }) => {
    await bootReady(page);
    await page.locator("#info-btn").focus();
    await page.click("#info-btn");
    await expect(page.locator("#modal")).toHaveClass(/open/);
    // close by mouse
    await page.click("#modal-close");
    await expect(page.locator("#modal")).not.toHaveClass(/open/);
    // reopen and close by keyboard (Escape), focus should return to the trigger
    await page.click("#info-btn");
    await expect(page.locator("#modal")).toHaveClass(/open/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#modal")).not.toHaveClass(/open/);
    const active = await page.evaluate(() => document.activeElement?.id);
    expect(active).toBe("info-btn");
  });

  test("no horizontal overflow at the current viewport", async ({ page }) => {
    await bootReady(page);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBeFalsy();
    // also with a zone panel open
    await page.click('.zone-chip[data-id="neck"]');
    const overflow2 = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow2).toBeFalsy();
  });

  test("respects reduced motion without breaking (no errors)", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = attachDiagnostics(page);
    await bootReady(page);
    await page.click('.zone-chip[data-id="abdomen"]');
    await page.waitForTimeout(1000);
    const real = errors.filter(e => !/favicon/i.test(e));
    expect(real, real.join("\n")).toEqual([]);
    await context.close();
  });
});

test.describe("Settings & keyboard (v0.2)", () => {
  test("settings popover opens, closes on Escape, and persists to localStorage", async ({ page }) => {
    await bootReady(page);
    await page.click("#settings-btn");
    await expect(page.locator("#settings-pop")).toBeVisible();
    await page.click("#set-sound");   // sound: on -> off
    await page.click("#motion-on");   // motion: auto -> on
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings-pop")).toBeHidden();

    await page.reload();
    await expect(page.locator("#loader")).toHaveClass(/hidden/, { timeout: 15000 });
    await page.click("#settings-btn");
    await expect(page.locator("#set-sound")).not.toBeChecked();
    await expect(page.locator("#motion-on")).toBeChecked();
  });

  test("number keys select zones; Space and N/P drive the steps", async ({ page }) => {
    await bootReady(page);
    await page.keyboard.press("3"); // 3rd zone = axillary
    await expect(page.locator("#detail-panel")).toHaveClass(/open/);
    await expect(page.locator('.zone-chip[data-id="axillary"]')).toHaveClass(/active/);

    const t1 = await page.locator("#sa-title").textContent();
    await page.keyboard.press("n");
    await expect(page.locator("#sa-title")).not.toHaveText(t1);
    await page.keyboard.press("p");
    await expect(page.locator("#sa-title")).toHaveText(t1);

    await page.keyboard.press(" ");
    await expect(page.locator("#btn-play")).toContainText("Pause");
    await page.keyboard.press(" ");
    await expect(page.locator("#btn-play")).toContainText("Start step");
  });

  test("voice toggle reflects Web Speech availability", async ({ page }) => {
    await bootReady(page);
    await page.click("#settings-btn");
    const voice = page.locator("#set-voice");
    if (await voice.isDisabled()) {
      await expect(page.locator("#voice-unavailable")).toBeVisible();
    } else {
      await voice.check();
      await expect(voice).toBeChecked();
    }
  });

  test("forcing reduced motion via settings does not error", async ({ page }) => {
    const errors = attachDiagnostics(page);
    await bootReady(page);
    await page.click("#settings-btn");
    await page.click("#motion-on");
    await page.keyboard.press("Escape");
    await page.click('.zone-chip[data-id="leg"]');
    await page.waitForTimeout(800);
    const real = errors.filter(e => !/favicon/i.test(e));
    expect(real, real.join("\n")).toEqual([]);
  });
});

test.describe("Knowledge base", () => {
  test("Learn hub opens with tabs and switches content", async ({ page }) => {
    await bootReady(page);
    await page.click("#info-btn");
    await expect(page.locator("#modal")).toHaveClass(/open/);
    await expect(page.locator(".kb-tab")).toHaveCount(8);
    await page.click('.kb-tab[data-tab="nodes"]');
    await expect(page.locator(".kb-diagram")).toBeVisible();
    await page.click('.kb-tab[data-tab="regions"]');
    await expect(page.locator(".kb-table tbody tr")).toHaveCount(8);
    await page.click('.kb-tab[data-tab="glossary"]');
    await expect(page.locator(".kb-term").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#modal")).not.toHaveClass(/open/);
  });

  test("zone panel shows anatomy/clinical detail and links into the hub", async ({ page }) => {
    await bootReady(page);
    await page.click('.zone-chip[data-id="axillary"]');
    await expect(page.locator(".node-card")).toHaveCount(1);
    await expect(page.locator(".node-card .nc-note")).toContainText("breast");
    await page.click(".kb-link");
    await expect(page.locator("#modal")).toHaveClass(/open/);
    await expect(page.locator(".kb-tab.active")).toHaveAttribute("data-tab", "nodes");
  });

  test("safety link opens the hub on the Safety tab", async ({ page }) => {
    await bootReady(page);
    await page.click("#precaution-more");
    await expect(page.locator("#modal")).toHaveClass(/open/);
    await expect(page.locator(".kb-tab.active")).toHaveAttribute("data-tab", "safety");
  });
});

test.describe("Programs & progress (v0.3)", () => {
  test("programs popover lists routines and starts a targeted session", async ({ page }) => {
    await bootReady(page);
    await page.click("#programs-btn");
    await expect(page.locator("#programs-pop")).toBeVisible();
    await expect(page.locator(".pp-item")).toHaveCount(6);
    await page.click('.pp-item[data-prog="legs"]');
    await expect(page.locator(".session-banner")).toContainText("Tired legs");
    await expect(page.locator(".session-banner")).toContainText("1/4"); // 4-region program
    await expect(page.locator("#start-session")).toContainText("Stop session");
  });

  test("Escape closes the programs popover", async ({ page }) => {
    await bootReady(page);
    await page.click("#programs-btn");
    await expect(page.locator("#programs-pop")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#programs-pop")).toBeHidden();
  });

  test("completing a program records progress (localStorage) and shows the count", async ({ page }) => {
    await bootReady(page);
    await page.click("#programs-btn");
    await page.click('.pp-item[data-prog="face"]'); // 2 zones: terminus(3) + neck(4)
    await expect(page.locator(".session-banner")).toContainText("1/2");
    // Walk through every step to completion with the Next shortcut.
    for (let i = 0; i < 9; i++) await page.keyboard.press("n");
    await expect(page.locator(".session-banner")).toHaveCount(0); // session ended
    const total = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("lymphflow.progress.v1")).total; } catch { return 0; }
    });
    expect(total).toBeGreaterThanOrEqual(1);
    await page.click("#programs-btn");
    await expect(page.locator(".pp-head")).toContainText("completed");
    await expect(page.locator('.pp-item[data-prog="face"] .pp-count')).toBeVisible();
  });
});

test.describe("PWA (v1.0)", () => {
  test("manifest is linked, served, and describes the app", async ({ page }) => {
    await bootReady(page);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
    const resp = await page.request.get("/manifest.webmanifest");
    expect(resp.ok()).toBeTruthy();
    const mf = await resp.json();
    expect(mf.name).toContain("Lymph Flow");
    expect(mf.display).toBe("standalone");
    expect(mf.icons.length).toBeGreaterThan(0);
    // every icon resolves
    for (const icon of mf.icons) {
      const r = await page.request.get("/" + icon.src);
      expect(r.ok(), icon.src).toBeTruthy();
    }
  });

  test("service worker registers, controls the page, and the version is shown", async ({ page }) => {
    await bootReady(page);
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null,
      null, { timeout: 15000 });
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    expect(controlled).toBeTruthy();
    await expect(page.locator("#app-version")).toContainText("v1.0.0");
  });

  test("app boots offline from the service-worker cache", async ({ page, context }) => {
    const errors = attachDiagnostics(page);
    await bootReady(page);
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null,
      null, { timeout: 15000 });
    await page.waitForTimeout(1500); // let the precache settle
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#loader")).toHaveClass(/hidden/, { timeout: 15000 });
    await expect(page.locator(".zone-chip")).toHaveCount(8); // full app booted with no network
    await context.setOffline(false);
    const real = errors.filter(e => !/favicon/i.test(e));
    expect(real, real.join("\n")).toEqual([]);
  });
});
