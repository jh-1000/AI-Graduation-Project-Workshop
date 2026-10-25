import { defineConfig, devices } from "@playwright/test";

// 被测应用是 Next.js dev server（npm run dev → next dev -p 4321）。
// 若本机已有 dev server 在跑（reuseExistingServer），Playwright 直接复用，不重复起进程。
const PORT = 4321;
const BASE_URL = process.env.PW_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // 单 worker：测试只读同一个 SQLite 基线项目，并行没有收益还会互相干扰断言。
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
