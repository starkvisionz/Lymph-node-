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
