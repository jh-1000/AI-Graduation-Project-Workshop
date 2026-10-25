import { test, expect, type Page } from "@playwright/test";

// 基线项目必须按 slug 解析，不能硬编码 id：
// `npm run regression` 每次 cleanup 后重建项目，id 会变。
const BASELINE_SLUG = "regression-fixture1";

let projectId: number;

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/projects");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { projects?: { id: number; slug: string }[] };
  const baseline = (body.projects ?? []).find((p) => p.slug === BASELINE_SLUG);
  expect(
    baseline,
    `基线项目 slug=${BASELINE_SLUG} 不存在：请先执行 npm run regression 生成 fixture1 基线数据`,
  ).toBeTruthy();
  projectId = baseline!.id;
});

/** 按 h2 文本前缀定位区块，避免依赖 class 名或 data-testid（页面当前 0 处 data-testid）。 */
function section(page: Page, headingPrefix: string | RegExp) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: headingPrefix }),
  });
}

test.describe("P1 最小闭环 · 项目详情页五区块", () => {
  test("S1 页头与三总状态声明", async ({ page }) => {
    await page.goto(`/project/${projectId}`);

    // A6：三总状态不可省略 —— 防止把「代表性文件分析完成」冒充成「整库分析完成」。
    await expect(page.getByRole("heading", { level: 1, name: "项目分析" })).toBeVisible();
    await expect(page.getByText("初步清单 · 不代表完整分析")).toBeVisible();

    // 返回链接可点回首页
    const back = page.getByRole("link", { name: "← 返回项目列表" });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByRole("heading", { level: 1, name: "项目" })).toBeVisible();
  });

  test("S2 证据卡：证据行与符号 chip 都带可回溯的 file:line", async ({ page }) => {
    await page.goto(`/project/${projectId}`);
    const card = section(page, /^证据卡/);

    await expect(card.getByRole("heading", { name: /^证据卡/ })).toContainText(
      "版本 scan-v1 · 证据 3 条 · 符号 3 个",
    );

    // A1：三条证据必须 file_path:start_line ↔ note 精确配对，且同一条目内出现。
    const pairs: [string, string][] = [
      ["src/server/index.ts:7", "endpoint: GET /api/tasks"],
      ["src/server/index.ts:12", "endpoint: POST /api/tasks"],
      ["src/server/index.ts:22", "endpoint: PATCH /api/tasks/:id"],
    ];
    const rows = card.locator("ul > li");
    await expect(rows).toHaveCount(pairs.length);
    for (const [location, note] of pairs) {
      const row = rows.filter({ hasText: location });
      await expect(row, `证据条目缺失：${location}`).toHaveCount(1);
      await expect(row).toContainText(note);
      await expect(row).toContainText("static_analyzer");
      await expect(row).toContainText("extracted");
      await expect(row).toContainText("current");
    }

    // A2：符号 chip 必须同时含名字与 file:line，不允许退化成「只有符号名」。
    const symbols: [string, string][] = [
      ["formatDate", "src/utils/format.ts:1"],
      ["TasksPage", "src/web/TasksPage.tsx:4"],
      ["handleSubmit", "src/web/TasksPage.tsx:8"],
    ];
    for (const [name, location] of symbols) {
      const chip = card.locator("span").filter({ hasText: new RegExp(`^${name}\\s`) }).first();
      await expect(chip, `符号 chip 缺失：${name}`).toBeVisible();
      await expect(chip).toContainText(location);
    }
  });

  test("S3 业务流程：步数、顺序与每步 file:line", async ({ page }) => {
    await page.goto(`/project/${projectId}`);
    const flowSection = section(page, /^业务流程/);

    await expect(flowSection.getByRole("heading", { name: /^业务流程/ })).toContainText("业务流程（2）");
    await expect(flowSection).toContainText("触发：");

    // A3：POST 流程必须 6 步、seq 严格 1..6、末步 index.ts:18，不允许只断言「有步骤列表」。
    const postFlow = flowSection.locator("div.px-5").filter({ hasText: "POST /api/tasks 写入流程" }).first();
    await expect(postFlow).toBeVisible();
    await expect(postFlow).toContainText("draft");

    const steps = postFlow.locator("ol > li");
    await expect(steps).toHaveCount(6);

    const expected: [string, string, string][] = [
      ["1", "用户触发前端事件", "src/web/TasksPage.tsx:30"],
      ["2", "handleSubmit 组装请求", "src/web/TasksPage.tsx:8"],
      ["3", "发起 POST /api/tasks", "src/web/TasksPage.tsx:11"],
      ["4", "服务端处理 POST /api/tasks", "src/server/index.ts:12"],
      ["5", "读写 tasks 表", "src/db/schema.sql:1"],
      ["6", "返回响应", "src/server/index.ts:18"],
    ];
    for (let i = 0; i < expected.length; i++) {
      const [seq, title, location] = expected[i];
      const step = steps.nth(i);
      await expect(step, `第 ${i + 1} 步序号`).toContainText(seq);
      await expect(step, `第 ${i + 1} 步标题`).toContainText(title);
      await expect(step, `第 ${i + 1} 步位置`).toContainText(location);
    }

    // PATCH 流程 3 步
    const patchFlow = flowSection.locator("div.px-5").filter({ hasText: "PATCH /api/tasks/:id 写入流程" }).first();
    await expect(patchFlow).toBeVisible();
    const patchSteps = patchFlow.locator("ol > li");
    await expect(patchSteps).toHaveCount(3);
    await expect(patchSteps.nth(2)).toContainText("src/server/index.ts:23");
  });

  test("S4 三区块空态必须说明「为什么空」", async ({ page }) => {
    await page.goto(`/project/${projectId}`);

    // A4：四个空态各自的关键短语 —— 不允许统一退化成「暂无数据」。
    const nodes = section(page, /^知识节点/);
    await expect(nodes.getByRole("heading", { name: /^知识节点/ })).toContainText("知识节点（0）");
    await expect(nodes).toContainText("API Key");

    const terms = section(page, /^术语卡片/);
    await expect(terms.getByRole("heading", { name: /^术语卡片/ })).toContainText("术语卡片（0）");
    await expect(terms).toContainText("需模型生成");

    const quiz = section(page, /^自测题/);
    await expect(quiz.getByRole("heading", { name: /^自测题/ })).toContainText("自测题（0）");
    await expect(quiz).toContainText("尚无自测题：需模型生成。");

    const locate = section(page, /^定位挑战/);
    await expect(locate.getByRole("heading", { name: /^定位挑战/ })).toContainText("定位挑战（0）");
    await expect(locate).toContainText("尚无定位挑战：需模型生成。");
  });

  test("S5 错误态：不存在的项目不得整页崩溃", async ({ page }) => {
    const missingId = 999999;
    await page.goto(`/project/${missingId}`);

    // A5：这是 2026-10-25 实机走查真实出现过的崩溃（load() 未检查 res.ok），断言必须能复现该回归。
    await expect(page.getByText(`项目 ${missingId} 不存在或已被删除`)).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(page.getByText("加载中…")).toHaveCount(0);
  });

  test("S7 版本一致性：页面副标题与 evidence 端点同版本", async ({ page, request }) => {
    await page.goto(`/project/${projectId}`);

    const res = await request.get(`/api/projects/${projectId}/evidence`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      analysisVersion: string | null;
      evidence: unknown[];
      symbols: unknown[];
    };
    expect(body.analysisVersion).toBe("scan-v1");
    expect(body.evidence).toHaveLength(3);
    expect(body.symbols).toHaveLength(3);

    // 带显式 version 与不带 version 必须一致
    const withVersion = await request.get(
      `/api/projects/${projectId}/evidence?version=${body.analysisVersion}`,
    );
    expect(withVersion.ok()).toBeTruthy();
    const same = (await withVersion.json()) as { analysisVersion: string | null; evidence: unknown[] };
    expect(same.analysisVersion).toBe(body.analysisVersion);
    expect(same.evidence).toHaveLength(3);

    // 页面副标题里的版本号与端点一致
    const card = section(page, /^证据卡/);
    await expect(card.getByRole("heading", { name: /^证据卡/ })).toContainText(
      `版本 ${body.analysisVersion}`,
    );
  });
});
