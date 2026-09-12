import { defineConfig } from "@playwright/test";

const deployedBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 120_000,
  reporter: [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: deployedBaseURL ?? "http://127.0.0.1:4173",
    trace: "on",
  },
  webServer: deployedBaseURL ? undefined : {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: (["chromium", "webkit"] as const).map(browserName => ({
      name: `${browserName}-touch-landscape`,
      use: {
        browserName,
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    })),
});
