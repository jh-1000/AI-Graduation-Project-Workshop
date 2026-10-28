import { test, expect } from "@playwright/test";

/**
 * UI 回归（按 demo 重建后的信息架构）：
 * 所有功能页挂在 /project/[id]/ 下；基线项目按 slug 解析（regression 会重建，id 会变）。
 * 断言重点：真实数据可点、空态必须诚实说明原因、跳转与证据链接可回溯。
 */

const BASELINE_SLUG = "regression-fixture1";
let projectId = 0;

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/projects");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { projects?: { id: number; slug: string }[] };
  const baseline = (body.projects ?? []).find((p) => p.slug === BASELINE_SLUG);
  expect(baseline, `基线项目 ${BASELINE_SLUG} 不存在：先执行 npm run regression`).toBeTruthy();
  projectId = baseline!.id;
});

test.describe("新 IA · 项目作用域与侧栏", () => {
  test("U1 总览页：三个独立状态 + 侧栏链接全部带项目 id", async ({ page }) => {
    await page.goto(`/project/${projectId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("分析任务完成")).toBeVisible();
    await expect(page.getByText("覆盖充分")).toBeVisible();
    await expect(page.getByText(/结论有证据支撑/)).toBeVisible();
    const hrefs = await page.locator("aside nav a").evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
    );
    for (const h of hrefs) {
      if (h.startsWith("/project/")) {
        expect(h === `/project/${projectId}` || h.startsWith(`/project/${projectId}/`)).toBeTruthy();
      }
    }
  });

  test("U2 侧栏跳转：知识图谱页渲染画布", async ({ page }) => {
    await page.goto(`/project/${projectId}`);
    await page.locator("aside nav a", { hasText: "知识图谱" }).click();
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/graph`));
    await expect(page.locator("#gcanvas")).toBeVisible();
    await expect(page.getByText(/2D 力导向/)).toBeVisible();
  });

  test("U3 代码库：直接定位到 file:line 并显示证据行", async ({ page }) => {
    await page.goto(`/project/${projectId}/code?path=${encodeURIComponent("src/server/index.ts")}&line=12`);
    await expect(page.getByText(/第 12 行/)).toBeVisible();
    await expect(page.locator(".ccode .cl.cur")).toHaveCount(1);
    await expect(page.locator(".ccode .cl.ev").first()).toBeVisible();
    await expect(page.getByText("符号大纲")).toBeVisible();
  });

  test("U4 流程线：站点 + 四动作 + 证据链接", async ({ page }) => {
    await page.goto(`/project/${projectId}/flow`);
    await expect(page.getByText(/业务流程线/).first()).toBeVisible();
    // 等客户端取数完成：站点或"尚无业务流程"空态出现后再断言（避免 race）
    await expect(
      page.locator(".station").first().or(page.getByText("尚无业务流程"))
    ).toBeVisible();
    const stations = await page.locator(".station").count();
    expect(stations).toBeGreaterThan(0);
    await page.getByRole("button", { name: "看代码" }).click();
    await expect(page.getByText(/证据卡 · 源码位置/)).toBeVisible();
    await expect(page.locator(".ev a.mono")).toBeVisible();
  });

  test("U5 知识库：真实统计 + 复习队列（空态诚实）", async ({ page }) => {
    await page.goto(`/project/${projectId}/kb`);
    await expect(page.getByText(/知识点 · 来自本项目分析|技术栈学习路径/).first()).toBeVisible();
    await expect(page.getByText(/今天没有到期卡片|点击卡片翻面|按技术栈路径/).first()).toBeVisible();
  });

  test("U6 知识点页：无数据时给出去处，不伪造内容", async ({ page }) => {
    await page.goto(`/project/${projectId}/node`);
    // 空态或真实内容都合法；等客户端取数完成后再断言（避免 race）
    await expect(page.getByText(/尚无知识点|分段讲解/).first()).toBeVisible();
  });

  test("U7 答辩页：题库空态或一次一问", async ({ page }) => {
    await page.goto(`/project/${projectId}/defend`);
    await expect(page.getByText(/尚无答辩题|共 \d+ 问/).first()).toBeVisible();
  });

  test("U8 挑战页：定位题空态或可校验；诚实边界可见", async ({ page }) => {
    await page.goto(`/project/${projectId}/challenge`);
    await expect(page.getByText("验证闭环六查")).toBeVisible();
    // 题库为空 → 诚实空态；有题 → 出现定位校验入口（等客户端取数完成）
    await expect(
      page.getByRole("button", { name: "校验定位" }).or(page.getByText(/不会伪造题目/))
    ).toBeVisible();
  });

  test("U9 雷达页：只展示有证据的部分", async ({ page }) => {
    await page.goto(`/project/${projectId}/radar`);
    await expect(page.getByText(/没有单一分数/)).toBeVisible();
    await expect(page.getByText(/不做没有证据的雷达图/)).toBeVisible();
  });

  test("U10 不存在的项目：404 而不是整页崩溃", async ({ page }) => {
    const res = await page.goto(`/project/999999`);
    expect(res?.status()).toBe(404);
  });
});
