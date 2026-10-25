---
project: proj-analysis-learner
type: test-plan
parent: "[[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]]"
date: 2026-10-25
status: 已执行
phase: fe-test
point: FE-p1-loop
plan_mode: true
executed: true
result: "[[05-Test-Tasks/FE-TEST-p1-loop|FE-TEST-p1-loop]]"
executed_at: 2026-10-26
engine: @playwright/test (npm) 1.61.0
---

# FE-PW-PLAN-p1-loop · P1 最小闭环前端验收计划

> 状态：**草稿**。本文件只含计划，不含 `.spec.ts`、未安装依赖、未执行任何测试。
> 计划稳定需用户明确回「已审查」或「批准」；执行需用户明确回「模式:执行」或「执行测试」。

## 来源

| 项 | 内容 |
| --- | --- |
| 被测功能 | P1 最小闭环：项目详情页五个区块（证据卡 / 业务流程 / 知识节点 / 术语卡片 / 自测题+定位挑战）+ 错误态 |
| 开发任务 | [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]]（status: done，本轮补「待测清单」一节） |
| UI 设计 | [[02-Design/modules/analysis/ui/p1-loop/UI\|UI]]（`fe_demo_file: src/app/project/[id]/page.tsx`，`fe_demo_route: /project/[id]`） |
| 需求 | [[01-Requirements/modules/analysis/map-pipeline/map-pipeline\|map-pipeline]]（F-3 流程还原、F-4 知识点生成、R-2 阶段落盘） |
| 代码 | `src/app/project/[id]/page.tsx`（567 行）；5 个只读端点 `src/app/api/projects/[id]/{evidence,flows,nodes,terms,practice}/route.ts` |
| 验收标准缺口 | `map-pipeline/SPEC.md` 的 AC-1 只覆盖「重跑经缓存后成本下降且结论一致」，与前端可见性无直接对应。本计划的前端断言以 UI.md 的可见文案 + 真实代码为准，该缺口记入本文件「验收缺口」一节，不自行新增 SPEC |

## 范围

**覆盖（本轮）**

- 路由 `/project/[id]`，基线项目 **id=37（`regression-fixture1`）**
- 五区块渲染：证据卡、业务流程、知识节点、术语卡片、自测题、定位挑战
- 三区块空态（无 API Key 时）：知识节点 / 术语卡片 / 自测题 / 定位挑战
- 错误态：不存在的项目 id
- 页头三总状态声明（「初步清单 · 不代表完整分析」）

**不覆盖（明确出范围）**

- 首页 `/`（导入表单）与 `/settings`（密钥填写）—— 属 P0 既有页面，另有回归脚本覆盖导入链路
- `启动扫描任务（scan）` / `启动完整分析（map）` 按钮的真实触发（会写 `data/app.db`、派生子进程），本轮只做人工检查项
- LLM 三阶段的真实产出（`settings` 表 0 行，`src/lib/settings.ts:46` 密钥只写不读，无法在测试中构造）
- 大仓库（1385 文件）渲染性能、窄屏响应式
- 写库、migration、worker 逻辑（属 BE 侧，见 05-Test-Tasks 的 Backend API Acceptance）

## Decision Review Record

| 字段 | 内容 |
| --- | --- |
| 范围 | 仅项目详情页五区块 + 错误态的前端验收计划；只写 Wiki，不装依赖、不写 `.spec.ts`、不跑测试 |
| 事实证据 | 见下方「环境」「Seed-Setup」两节的实测数据；页面行号锚点取自 `src/app/project/[id]/page.tsx` 原文 |
| Challenge | 若本计划是错误的，最可能错在：把「fixture 的 3 条端点证据」当成「任意项目都应有的证据量」。核对：证据行数取决于 `extractFromFile` 的正则命中，不同项目差异极大（真实仓库 1385 文件只出 6 条 evidence），故断言必须绑定基线项目 id=37，不得写成通用数值 |
| 依赖与风险 | `A → B`：基线项目 37 存在 → 五区块有数据；`settings` 0 行 → 三个 LLM 区块必为空。风险：`npm run regression` / `npx tsx scripts/verify/c-loop.ts` 会 cleanup 重建项目（id 会变），基线 id 在跑过回归后可能失效 |
| 完整性 | §7 十项已过；本计划无 NEED_CONFIRM（用户 m02411 已授权路径与范围）；执行授权仍缺（需「模式:执行」） |
| 决策分类 | 计划入库 = READY（用户已回「两个都写」）；安装 `@playwright/test` = NEED_CONFIRM（未获授权）；执行测试 = BLOCKED（缺「模式:执行」）；补 `data-testid` = DEFERRED |
| 授权要求 | 写本文件需「入库」（已获，m02411）；安装依赖与生成 `.spec.ts` 并运行需「模式:执行」（未获）；改业务源码需「按方案开发」（未获） |

## 环境

| 项 | 实测值 |
| --- | --- |
| Node / npm | v24.11.1 / 11.6.2 |
| 应用 | Next.js 15.5.28，dev 端口 **4321**（`npm run dev` → `next dev -p 4321`） |
| dev server 状态 | 本轮实测 `http://127.0.0.1:4321/` 返回 200（后台 job 常驻） |
| npm 侧 Playwright | **未安装**：`devDependencies` 10 项无 playwright；无 `playwright.config.*`；`package.json` scripts 无 `test`；`npx --no-install playwright --version` 报 `npx canceled due to missing packages and no YES option: ["playwright@1.64.1"]` |
| Python 侧 Playwright | 已装 1.61.0（`D:\myapp\python3.12.9\Scripts\playwright.exe`）—— 本轮**不采用**该路径（用户 m02411 选 B：npm `@playwright/test`） |
| 浏览器二进制 | 缓存 `C:\Users\26940\AppData\Local\ms-playwright` 约 1.39GB：`chromium-1228`（149.0.7827.55，415.4MB）、`chromium-1243`（431.9MB）、`chromium_headless_shell-1228`（269.5MB）、`chromium_headless_shell-1243`（270.1MB）、`ffmpeg-1011`、`winldd-1007` |
| 无需再下载 | `browsers.json` 把 chromium 映射到 revision **1228**，与缓存精确匹配；`@playwright/test@1.61.0` 对应 1228，`1.64.1` 对应 1243，两者都已在缓存中 → **任何一条安装路径都无需再下载浏览器** |
| 实测佐证 | 用 Python 探针跑通过一次：chromium 149.0.7827.55 启动 → 打开 `http://127.0.0.1:4321/` → 读到 `h1` 文本「项目」（探针已删除） |
| 本机浏览器 | Edge `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`；Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe`（均可作 `channel` 备选） |
| 建议安装命令（未执行） | `npm i -D @playwright/test@1.61.0`（锁定与缓存 revision 1228 匹配的版本，避免额外下载） |
| 环境风险 | `tsconfig.json` 的 `exclude` 只有 `node_modules / fixtures / data / worker/fixtures`，新增 `e2e/*.spec.ts` 会被 `tsc --noEmit` 纳入类型检查；若 Playwright 类型与 `strict` 冲突，需在 tsconfig 增加 `e2e` 排除或补 `@playwright/test` 的 types |

## Seed-Setup（测试前置，全部只读核对，不写库）

基线项目：**id=37，slug=`regression-fixture1`，name=`回归-fixture1`，source_type=`path`**。

| 表 | project 37 实测行数 | 用途 |
| --- | --- | --- |
| `files` | 6 | 文件表区块 |
| `symbols` | 3（`analysis_version=scan-v1`） | 证据卡符号 chip |
| `evidence` | 3（`analysis_version=scan-v1`，note 为三条端点） | 证据卡证据行 |
| `flows` | 2（`post-api-tasks` / `patch-api-tasks`，`status=draft`，`analysis_version=scan-v1`） | 业务流程区块 |
| `flow_steps` | 9（6 + 3） | 业务流程步骤 |
| `nodes` / `terms` / `practice_items` | 0 / 0 / 0 | 三区块空态 |
| `open_questions` | 0 | — |
| `settings` | 0（全库） | 解释为何 LLM 区块为空 |

另一项目 id=39（`c-loop-fixture1`）有 `flows=0`，**不能**作为业务流程的基线。

证据与流程的精确期望值（来自库内回读，与 `fixtures/fixture1-expected.json` 一致）：

- 证据三条：`src/server/index.ts:7` → `endpoint: GET /api/tasks`；`src/server/index.ts:12` → `endpoint: POST /api/tasks`；`src/server/index.ts:22` → `endpoint: PATCH /api/tasks/:id`；三条均为 `origin=static_analyzer` / `processing=extracted` / `freshness=current`
- 符号三个：`formatDate @ src/utils/format.ts:1`、`TasksPage @ src/web/TasksPage.tsx:4`、`handleSubmit @ src/web/TasksPage.tsx:8`
- 流程 `post-api-tasks`（标题 `POST /api/tasks 写入流程`）6 步：1 用户触发前端事件 `src/web/TasksPage.tsx:30`；2 handleSubmit 组装请求 `:8`；3 发起 POST /api/tasks `:11`；4 服务端处理 POST /api/tasks `src/server/index.ts:12`；5 读写 tasks 表 `src/db/schema.sql:1`；6 返回响应 `src/server/index.ts:18`
- 流程 `patch-api-tasks`（标题 `PATCH /api/tasks/:id 写入流程`）3 步：1 服务端处理 PATCH `src/server/index.ts:22`；2 读写 tasks 表 `src/db/schema.sql:1`；3 返回响应 `src/server/index.ts:23`

**Seed 生成方式（执行阶段才用，本轮不跑）**：`npm run regression` 会 cleanup 后重建项目（id 会变），因此执行阶段必须先从 `GET /api/projects` 按 `slug=regression-fixture1` 解析出当前 id，**禁止硬编码 37**。

## 数据生命周期

- 本轮**不产生任何测试数据**：只写计划文件。
- 执行阶段默认**复用**上述已存在的基线项目，不注入新数据、不新建项目。
- `keep_data` 解析优先级：命令行 `--keep-data` > 项目 `aidd-wiki/aidd.config.yml` 的 `test.default_keep_data`（该文件**不存在**） > 技能 `config.yml`（默认 `false`） > 默认清理。执行阶段按此顺序解析，**不询问是否保留测试数据**。
- 若执行阶段需要临时项目，必须在同一轮内清理（复用 `src/lib/db/index.ts` 的 `deleteProjectData(projectId)`），并记录清理结果。

## 场景

| ID | 场景 | 前置 | 预期（可见文本/状态） | 自动化适配度 |
| --- | --- | --- | --- | --- |
| S1 | 页头与三总状态声明 | 打开 `/project/37` | `h1` = `项目分析`；页面出现琥珀徽标文本 `初步清单 · 不代表完整分析`；`← 返回项目列表` 链接可点回 `/` | 是 |
| S2 | 证据卡渲染 | 同上 | 副标题 = `版本 scan-v1 · 证据 3 条 · 符号 3 个`；三条证据各含 `file_path` + `:start_line` + note + 三个徽标（`static_analyzer` / `extracted` / `current`）；三个符号 chip 各含名字与 `file:line` | 是 |
| S3 | 业务流程渲染 | 同上 | 标题 `业务流程（2）`；`post-api-tasks` 6 步按 seq 1→6 顺序、每步带 `file_path:start_line`；`patch-api-tasks` 3 步；两条流程状态徽标均为 `draft`；出现 `触发：` 前缀文本 | 是 |
| S4 | 三区块空态 | 同上（`settings` 0 行） | `知识节点（0）` 且含 `需先在设置页填写 API Key`；`术语卡片（0）` 且含 `需模型生成`；`自测题（0）` 且含 `尚无自测题：需模型生成。`；`定位挑战（0）` 且含 `尚无定位挑战：需模型生成。` | 是 |
| S5 | 错误态：不存在的项目 | 打开 `/project/999999` | 页面出现 `项目 999999 不存在或已被删除`；**不得**出现 `Application error: a client-side exception has occurred`；不出现 `加载中…` 常驻 | 是 |
| S6 | 揭示交互（自测题 / 定位挑战） | 需要 `practice_items` 有数据（当前 0 行，需 API Key） | 点击 `查看答案` 前答案不可见、点击后可见且按钮变 `收起答案`；`揭示位置` 同理（`target_file:target_line`） | 否（缺数据源，见「人工检查项」） |
| S7 | 版本过滤一致性 | 同上 | `GET /api/projects/37/evidence?version=scan-v1` 与不带 `version` 返回的 `analysisVersion` 均为 `scan-v1`，`evidence`/`symbols` 各 3 条；页面副标题版本号与该端点一致 | 部分（API 断言可自动化，页面一致性靠 S2 间接覆盖） |

## 关键断言（优先证明业务状态，而非证明元素存在）

1. **证据行必须是「路径:行号 + note」的精确配对**，而不是「页面上有 3 个 div」。断言 `src/server/index.ts:12` 与 `endpoint: POST /api/tasks` 出现在**同一个证据条目**内 —— 这才证明「业务结论可回溯到源码位置」这条产品不变量成立。
2. **符号 chip 必须同时含名字与 `file:line`**（`formatDate` + `src/utils/format.ts:1`），只断言名字存在等于允许退化成无位置的符号列表。
3. **业务流程断言步数与顺序**：`post-api-tasks` 的第 1 步是前端触发、第 4 步是服务端端点、第 5 步是数据表 —— 断言 seq 序列与每步 `file:line`，证明追踪链方向正确（前端 → 服务端 → 表 → 响应）。
4. **空态断言必须含「为什么空」**：`知识节点（0）` 区块内必须出现 `API Key` 字样，只断言「暂无数据」会掩盖降级路径失效。
5. **错误态断言 `fatal` 文案且断言无 `Application error`**：这是 2026-10-25 实机走查中真实出现过的崩溃（`load()` 未检查 `res.ok`），断言必须能复现该回归。
6. **页头三总状态不可省略**：断言 `初步清单 · 不代表完整分析` 常驻，防止 UI 把「代表性文件分析完成」冒充成「整库分析完成」（项目 Must-not-③）。

## 不允许弱化的断言

- A1：S2 的三条证据 `file_path:start_line` 与 note **逐条精确匹配**（`index.ts:7`↔`GET`、`:12`↔`POST`、`:22`↔`PATCH`）。不允许改成「至少存在一条证据」或「包含 endpoint 字样」。
- A2：S2 的符号 chip 必须带 `file:line`。不允许退化为「符号名出现」。
- A3：S3 的 `post-api-tasks` 步数必须为 **6** 且 seq 严格递增 1..6，末步 `src/server/index.ts:18`。不允许只断言「有步骤列表」。
- A4：S4 的四个空态文案各自的关键短语（`API Key` / `需模型生成` / `尚无自测题：需模型生成。` / `尚无定位挑战：需模型生成。`）。不允许统一改成「暂无数据」。
- A5：S5 必须断言 `项目 999999 不存在或已被删除` 且断言页面**不含** `Application error`。不允许只断言「页面不白屏」。
- A6：S1 的 `初步清单 · 不代表完整分析` 必须出现在首屏。不允许移出断言集。

## 人工检查项

- S6 揭示交互：当前 `practice_items=0`，需用户到设置页填 API Key 后重跑 map 才能验证。在此之前只记录「未验证」。
- `启动扫描任务（scan）` / `启动完整分析（map）` 按钮：会写库并派生子进程，不在自动化中断言；人工确认按钮文案与说明文案（`map 在 scan 产物之上追加业务流程、节点讲解、术语与练习；未配置模型密钥时讲解类产物为空。`）与代码一致。
- 任务表「类型」列是否显示 `kind`（`scan` / `map`）。
- 大仓库渲染（1385 文件）与窄屏（≤768px）布局：本轮不覆盖，仅记录。

## Selector 与可访问性建议

现状：`src/app/project/[id]/page.tsx` **全文件 0 处 `data-testid`**，无 `aria-label`。因此本计划只能按**可见文本 + 角色**定位：

| 目标 | 建议定位方式（现状可用的） | 代码锚点 |
| --- | --- | --- |
| 页头标题 | `getByRole('heading', { name: '项目分析', level: 1 })` | `page.tsx:204` |
| 三总状态徽标 | `getByText('初步清单 · 不代表完整分析')` | `page.tsx:206` |
| 证据卡区块 | `getByRole('heading', { name: /^证据卡/ })`，再用其父 `section` 限定范围 | `page.tsx:304` |
| 业务流程区块 | `getByRole('heading', { name: /^业务流程（/ })` | `page.tsx:347-348` |
| 知识节点 / 术语卡片 / 自测题 / 定位挑战 | 同理按 `h2` 文本前缀定位 | `page.tsx:383` / `:415` / `:444` / `:468` |
| 启动按钮 | `getByRole('button', { name: '启动完整分析（map）' })` | `page.tsx:244-248` |
| 揭示按钮 | `getByRole('button', { name: '查看答案' })` / `{ name: '揭示位置' }` | `page.tsx:455-459` / `:478-482` |
| 错误态文案 | `getByText('项目 999999 不存在或已被删除')` | `page.tsx:139` + `:191` |

**建议（不在本轮实施）**：给五个 `section` 补 `data-testid`（如 `evidence-card` / `flow-list` / `node-list` / `term-list` / `practice-list`），给两个启动按钮补 `aria-label`。改动属业务源码，需「按方案开发」授权。

## 验收缺口（记入，不自行新增 SPEC）

- `01-Requirements/modules/analysis/map-pipeline/SPEC.md` 的 AC 只有 `AC-1`（重跑经缓存后成本下降且结论一致），没有一条覆盖「五区块在页面上可见且证据可回溯」。本计划以 UI.md + 代码为准执行验收，缺口记入 [[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]] 的待测清单，是否补 SPEC 由后续 `/aidd:spec` 决定。
- 三区块（节点/术语/练习）的**有数据**路径至今从未真实跑过（`settings` 0 行），本计划只能验收其空态。该缺口不是测试脚本能补的，属产品前置条件。

## 下一步

已执行（2026-10-26）。执行结论与证据见 [[05-Test-Tasks/FE-TEST-p1-loop\|FE-TEST-p1-loop]]：

1. 安装 `@playwright/test@1.61.0`（复用本机 chromium-1228 缓存，**未下载浏览器**）；落盘 `playwright.config.ts` 与 `e2e/p1-loop.spec.ts`。
2. S1–S5、S7 全部 **PASS（6 passed / 14.4s）**；S6 因 `practice_items=0` 未按 S6 自动化的原计划自动验证，保留在人工检查项。
3. 负向对照：把 S3 末步 `src/server/index.ts:18` 改写成 `:999` → `1 failed`，证明断言非假阳性；改回后复跑 6 passed。
4. 后续：用户填 API Key 后重跑 map 再补 S6；后端接口验收 `/aidd:be-test`；改动提交 `/aidd:commit`。

## 关联

| 产物 | 链接 |
| --- | --- |
| 开发任务 | [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]] |
| UI 设计 | [[02-Design/modules/analysis/ui/p1-loop/UI\|UI]] |
| 需求 | [[01-Requirements/modules/analysis/map-pipeline/map-pipeline\|map-pipeline]] |
| 决策登记 | [[Decision-Register\|Decision-Register]] |
