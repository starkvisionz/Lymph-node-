import { defineConfig, devices } from "@playwright/test";

const PORT = 8123;

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: `node scripts/serve.cjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
