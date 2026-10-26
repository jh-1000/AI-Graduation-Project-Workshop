import { test, expect, type APIRequestContext } from "@playwright/test";

// 后端接口验收（BE-API）：被测对象是 Next.js Route Handlers，不是 Java 服务。
// 因此复用项目已装的 @playwright/test 的 request 上下文做真实 HTTP 调用 ——
// 不新增依赖、不引入 Java 测试框架、不走 Mock。
const BASELINE_SLUG = "regression-fixture1";
const EMPTY_FLOW_SLUG = "c-loop-fixture1";

let baseId: number;
let emptyFlowId: number;

async function resolveId(request: APIRequestContext, slug: string): Promise<number> {
  const res = await request.get("/api/projects");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { projects: { id: number; slug: string }[] };
  const hit = body.projects.find((p) => p.slug === slug);
  expect(hit, `基线项目 slug=${slug} 不存在：请先执行 npm run regression`).toBeTruthy();
  return hit!.id;
}

test.beforeAll(async ({ request }) => {
  baseId = await resolveId(request, BASELINE_SLUG);
  emptyFlowId = await resolveId(request, EMPTY_FLOW_SLUG);
});

test.describe("BE-API · 项目与任务接口", () => {
  test("API-01 GET /api/projects 返回项目清单与文件数", async ({ request }) => {
    const res = await request.get("/api/projects");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { projects: { id: number; slug: string; file_count: number; created_at: string }[] };

    expect(Array.isArray(body.projects)).toBeTruthy();
    // 业务状态：基线项目必须存在且 file_count 与 files 表一致（fixture1 = 6）
    const base = body.projects.find((p) => p.slug === BASELINE_SLUG);
    expect(base).toBeTruthy();
    expect(base!.file_count).toBe(6);
    expect(base!.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // 排序契约：ORDER BY id DESC
    const ids = body.projects.map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  test("API-02 GET /api/projects/[id] 返回 project + stats + runs", async ({ request }) => {
    const res = await request.get(`/api/projects/${baseId}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      project: { id: number; slug: string; stack: string };
      stats: { parse_mode: string; n: number }[];
      runs: { id: number; version: string; kind: string; status: string }[];
    };

    expect(body.project.slug).toBe(BASELINE_SLUG);
    // stack 必须是可解析 JSON（前端直接 JSON.parse 之外还要读字段）
    const stack = JSON.parse(body.project.stack) as { languages?: string[]; frameworks?: string[] };
    expect(stack.languages).toEqual(expect.arrayContaining(["javascript", "typescript"]));
    expect(stack.frameworks).toEqual(expect.arrayContaining(["express"]));
    // stats 总数必须等于 file_count（6）
    expect(body.stats.reduce((s, x) => s + x.n, 0)).toBe(6);
    // runs 最多 10 条且含已完成扫描
    expect(body.runs.length).toBeGreaterThan(0);
    expect(body.runs.length).toBeLessThanOrEqual(10);
    expect(body.runs.some((r) => r.kind === "scan" && r.status === "completed")).toBeTruthy();
  });

  test("API-03 GET /api/projects/[id] 不存在 → 404 且带 error 文案", async ({ request }) => {
    const res = await request.get("/api/projects/999999");
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe("项目不存在");
  });

  test("API-04 GET /api/projects/[id]/preview 返回技术栈与端点清单", async ({ request }) => {
    const res = await request.get(`/api/projects/${baseId}/preview`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      stack: { languages: string[]; frameworks: string[] };
      stats: Record<string, number>;
      endpoints: { method: string; path: string; file: string; line: number }[];
      files: { path: string; parse_mode: string }[];
    };

    expect(body.stack.languages).toEqual(expect.arrayContaining(["javascript", "typescript"]));
    expect(body.files).toHaveLength(6);
    expect(body.stats.text_only).toBe(6);
    // 端点必须与 fixture 的真实源码位置一致（证明预览不是空壳）
    const eps = body.endpoints.map((e) => `${e.method} ${e.path} ${e.file}:${e.line}`);
    expect(eps).toEqual(
      expect.arrayContaining([
        "GET /api/tasks src/server/index.ts:7",
        "POST /api/tasks src/server/index.ts:12",
        "PATCH /api/tasks/:id src/server/index.ts:22",
      ]),
    );
  });

  test("API-05 GET /api/runs/[id] 返回任务状态机字段", async ({ request }) => {
    const list = await request.get(`/api/projects/${baseId}`);
    const runs = ((await list.json()) as { runs: { id: number }[] }).runs;
    expect(runs.length).toBeGreaterThan(0);
    const runId = runs[0].id;

    const res = await request.get(`/api/runs/${runId}`);
    expect(res.status()).toBe(200);
    const run = ((await res.json()) as { run: Record<string, unknown> }).run;
    expect(run.id).toBe(runId);
    // 状态机六态之一 + 关键字段存在（前端任务表直接渲染这些列）
    expect(["queued", "running", "paused", "completed", "failed", "cancelled"]).toContain(run.status);
    expect(["scan", "map", "invalidation"]).toContain(run.kind);
    expect(run).toHaveProperty("version");
    expect(run).toHaveProperty("recovery_count");
    expect(run).toHaveProperty("updated_at");
  });

  test("API-06 GET /api/runs/[id] 不存在 → 404", async ({ request }) => {
    const res = await request.get("/api/runs/999999");
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe("任务不存在");
  });
});

test.describe("BE-API · 证据与业务流只读接口", () => {
  test("API-07 GET evidence 按版本返回证据与符号（含精确 file:line）", async ({ request }) => {
    const res = await request.get(`/api/projects/${baseId}/evidence`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      analysisVersion: string;
      evidence: { file_path: string; start_line: number; end_line: number; origin: string; processing: string; freshness: string; note: string }[];
      symbols: { name: string; line: number; file_path: string; precision: string }[];
    };

    expect(body.analysisVersion).toBe("scan-v1");
    expect(body.evidence).toHaveLength(3);

    // 业务状态：证据 = 路径:行号 ↔ note 精确配对（不是「有几条记录」）
    const pairs: [string, number, string][] = [
      ["src/server/index.ts", 7, "endpoint: GET /api/tasks"],
      ["src/server/index.ts", 12, "endpoint: POST /api/tasks"],
      ["src/server/index.ts", 22, "endpoint: PATCH /api/tasks/:id"],
    ];
    for (const [file, line, note] of pairs) {
      const hit = body.evidence.find((e) => e.file_path === file && e.start_line === line);
      expect(hit, `证据缺失：${file}:${line}`).toBeTruthy();
      expect(hit!.note).toBe(note);
      expect(hit!.end_line).toBe(line);
      // 三维度徽标的数据源必须在接口层就是合法枚举值
      expect(hit!.origin).toBe("static_analyzer");
      expect(hit!.processing).toBe("extracted");
      expect(hit!.freshness).toBe("current");
    }

    expect(body.symbols).toHaveLength(3);
    const syms = body.symbols.map((s) => `${s.name}@${s.file_path}:${s.line}`);
    expect(syms.sort()).toEqual(
      [
        "formatDate@src/utils/format.ts:1",
        "handleSubmit@src/web/TasksPage.tsx:8",
        "TasksPage@src/web/TasksPage.tsx:4",
      ].sort(),
    );
    expect(body.symbols.every((s) => s.precision === "exact")).toBeTruthy();
  });

  test("API-08 GET evidence?version 版本过滤生效且与缺省一致", async ({ request }) => {
    const noVersion = await request.get(`/api/projects/${baseId}/evidence`);
    const explicit = await request.get(`/api/projects/${baseId}/evidence?version=scan-v1`);
    expect(explicit.status()).toBe(200);

    const a = (await noVersion.json()) as { analysisVersion: string; evidence: { id: number }[] };
    const b = (await explicit.json()) as { analysisVersion: string; evidence: { id: number }[] };
    expect(b.analysisVersion).toBe("scan-v1");
    expect(a.analysisVersion).toBe(b.analysisVersion);
    expect(b.evidence.map((e) => e.id)).toEqual(a.evidence.map((e) => e.id));

    // 不存在的版本必须返回空集，绝不能回落到其它版本的数据（D-2 跨版本堆积的防线）
    const ghost = await request.get(`/api/projects/${baseId}/evidence?version=ghost-v0`);
    expect(ghost.status()).toBe(200);
    const g = (await ghost.json()) as { evidence: unknown[]; symbols: unknown[] };
    expect(g.evidence).toHaveLength(0);
    expect(g.symbols).toHaveLength(0);
  });

  test("API-09 GET flows 返回业务流与有序步骤（seq 连续、末步可定位）", async ({ request }) => {
    const res = await request.get(`/api/projects/${baseId}/flows`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      analysisVersion: string;
      flows: { slug: string; title: string; status: string; trigger_desc: string | null; steps: { seq: number; title: string; file_path: string | null; start_line: number | null }[] }[];
    };

    expect(body.analysisVersion).toBe("scan-v1");
    expect(body.flows).toHaveLength(2);

    const post = body.flows.find((f) => f.slug === "post-api-tasks");
    expect(post, "缺少 post-api-tasks 业务流").toBeTruthy();
    expect(post!.title).toBe("POST /api/tasks 写入流程");
    expect(post!.status).toBe("draft");
    expect(post!.trigger_desc).toBeTruthy();
    // seq 必须严格 1..6 连续（前端按 seq 渲染序号圆点，断号即错）
    expect(post!.steps.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    const stepText = post!.steps.map((s) => `${s.title}@${s.file_path}:${s.start_line}`);
    expect(stepText).toEqual([
      "用户触发前端事件@src/web/TasksPage.tsx:30",
      "handleSubmit 组装请求@src/web/TasksPage.tsx:8",
      "发起 POST /api/tasks@src/web/TasksPage.tsx:11",
      "服务端处理 POST /api/tasks@src/server/index.ts:12",
      "读写 tasks 表@src/db/schema.sql:1",
      "返回响应@src/server/index.ts:18",
    ]);

    const patch = body.flows.find((f) => f.slug === "patch-api-tasks");
    expect(patch, "缺少 patch-api-tasks 业务流").toBeTruthy();
    expect(patch!.steps).toHaveLength(3);
    expect(patch!.steps[2].file_path).toBe("src/server/index.ts");
    expect(patch!.steps[2].start_line).toBe(23);
  });

  test("API-10 GET flows 对无业务流的项目返回空且不报错", async ({ request }) => {
    const res = await request.get(`/api/projects/${emptyFlowId}/flows`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { analysisVersion: string | null; flows: unknown[] };
    expect(body.analysisVersion).toBeNull();
    expect(body.flows).toHaveLength(0);
  });

  test("API-11 GET nodes / terms / practice 在无 LLM 产物时返回稳定空结构", async ({ request }) => {
    const nodes = await request.get(`/api/projects/${baseId}/nodes`);
    expect(nodes.status()).toBe(200);
    const nb = (await nodes.json()) as { analysisVersion: string | null; nodes: unknown[] };
    expect(nb.analysisVersion).toBeNull();
    expect(nb.nodes).toEqual([]);

    const terms = await request.get(`/api/projects/${baseId}/terms`);
    expect(terms.status()).toBe(200);
    expect((await terms.json()).terms).toEqual([]);

    const practice = await request.get(`/api/projects/${baseId}/practice`);
    expect(practice.status()).toBe(200);
    const pb = (await practice.json()) as { analysisVersion: string | null; items: unknown[] };
    expect(pb.analysisVersion).toBeNull();
    expect(pb.items).toEqual([]);
  });
});

test.describe("BE-API · 设置接口", () => {
  test("API-12 GET /api/settings 只回掩码、绝不回明文密钥", async ({ request }) => {
    const res = await request.get("/api/settings");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    // 契约：默认值来自 src/lib/settings.ts DEFAULTS
    expect(body.baseUrl).toBe("https://open.bigmodel.cn/api/paas/v4");
    expect(body.model).toBe("glm-4-flash");
    expect(body.temperature).toBe(0.2);
    expect(body.allowLocalModel).toBe(false);
    expect(body.maxContextChars).toBe(60000);
    // 安全断言（不可弱化）：响应里不得出现明文密钥字段
    expect(body).not.toHaveProperty("apiKey");
    expect(body).not.toHaveProperty("llm_api_key");
    expect(body).toHaveProperty("apiKeyMasked");
  });

  test("API-13 POST /api/settings 空 body 不产生任何写入", async ({ request }) => {
    const before = (await (await request.get("/api/settings")).json()) as Record<string, unknown>;
    const res = await request.post("/api/settings", { data: {} });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const after = (await (await request.get("/api/settings")).json()) as Record<string, unknown>;
    expect(after).toEqual(before);
  });
});

test.describe("BE-API · 写入路径的关键失败分支（均在校验阶段中止，不落库）", () => {
  test("API-14 POST /api/projects 缺 name / 缺 path / slug 冲突 → 400", async ({ request }) => {
    const noName = await request.post("/api/projects", { data: { mode: "path", path: "x" } });
    expect(noName.status()).toBe(400);
    expect((await noName.json()).error).toBe("缺少项目名称");

    const noPath = await request.post("/api/projects", { data: { name: "be-api-probe" } });
    expect(noPath.status()).toBe(400);
    expect((await noPath.json()).error).toBe("缺少本地路径");

    // 产品真实顺序：importFromPath 先做 realpath 授权（src/lib/ingest.ts:50）再查 slug 唯一性（:54）。
    // 所以这里必须给一个真实存在的目录，才能走到 slug 冲突分支；给假路径只会先撞 ENOENT。
    const dup = await request.post("/api/projects", {
      data: { name: "dup", slug: BASELINE_SLUG, mode: "path", path: process.cwd() },
    });
    expect(dup.status()).toBe(400);
    expect((await dup.json()).error).toContain("slug 已存在");

    // 顺序契约单独钉住：假路径 + 已存在 slug 时，报错必须来自 realpath 而不是 slug（证明授权先于唯一性）
    const orderProbe = await request.post("/api/projects", {
      data: { name: "dup2", slug: BASELINE_SLUG, mode: "path", path: "E:/__no_such_dir_for_be_test__" },
    });
    expect(orderProbe.status()).toBe(400);
    expect((await orderProbe.json()).error).toContain("ENOENT");
  });

  test("API-15 POST /api/projects 路径不存在 → 400（realpath 阶段中止）", async ({ request }) => {
    const res = await request.post("/api/projects", {
      data: { name: "be-api-probe", mode: "path", path: "E:/__no_such_dir_for_be_test__" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("ENOENT");
    // 失败分支不得留下项目行
    const list = (await (await request.get("/api/projects")).json()) as { projects: { slug: string; name: string }[] };
    expect(list.projects.some((p) => p.name === "be-api-probe")).toBe(false);
  });

  test("API-16 POST /api/projects/[id]/analyze 项目不存在 → 404 且不新建任务", async ({ request }) => {
    const res = await request.post("/api/projects/999999/analyze", { data: {} });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe("项目不存在");
  });
});
