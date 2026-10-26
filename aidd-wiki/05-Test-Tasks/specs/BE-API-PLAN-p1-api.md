---
project: proj-analysis-learner
type: test-plan
parent: "[[04-Dev-Tasks/BE-evidence|BE-evidence]]"
date: 2026-10-26
status: 已执行
phase: be-test
point: BE-API-p1-api
plan_mode: true
executed: true
result: "[[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]]"
executed_at: 2026-10-26
engine: @playwright/test (npm) 1.61.0 · APIRequestContext（真实 HTTP，无 Mock）
---

# BE-API-PLAN-p1-api · 后端接口验收计划

> 本计划与执行记录 **同批落库**：计划内容来自执行前的 27 条实测探针（`/aidd:be-test` 勘察轮），
> 执行后与计划的唯一差异（API-14 用例修正）如实记入 [[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]]。

## 来源

| 项 | 内容 |
| --- | --- |
| 被测对象 | 11 个 Next.js Route Handler（`src/app/api/**/route.ts`）——本项目**无 Java 服务**，be-test 的「Java API test」默认形态不适用 |
| 开发任务 | [[04-Dev-Tasks/BE-evidence\|BE-evidence]]（证据写入链路）+ [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]]（5 个只读端点与 UI） |
| 设计 | [[02-Design/modules/evidence/DES-evidence\|DES-evidence]] · [[02-Design/modules/analysis/DES-analysis\|DES-analysis]] |
| 接口标准 | `02-Design/standards/api.md`（25 行）；**无 `api/API.md`**（缺口见「验收缺口」） |
| 需求 | [[01-Requirements/modules/evidence/model/model\|model]]（F-2 证据两维）、[[01-Requirements/modules/analysis/map-pipeline/map-pipeline\|map-pipeline]]（R-2 阶段落盘） |
| 测试代码 | `e2e/api/p1-api.spec.ts`（314 行，16 用例） |

## 范围

**覆盖（本轮）**

| 端点 | 方法 | 断言组 |
| --- | --- | --- |
| `/api/projects` | GET | API-01 清单 + `file_count` + id DESC 排序 |
| `/api/projects` | POST | API-14 缺 name / 缺 path / slug 冲突 → 400；API-15 路径不存在 → 400 且不落库 |
| `/api/projects/[id]` | GET | API-02 project + stats + runs；API-03 不存在 → 404 |
| `/api/projects/[id]/preview` | GET | API-04 技术栈 + 端点 file:line 精确 |
| `/api/projects/[id]/analyze` | POST | API-16 项目不存在 → 404 且不新建任务 |
| `/api/projects/[id]/evidence` | GET | API-07 证据/符号精确配对；API-08 版本过滤 |
| `/api/projects/[id]/flows` | GET | API-09 业务流与有序步骤；API-10 空项目 |
| `/api/projects/[id]/{nodes,terms,practice}` | GET | API-11 无 LLM 产物时稳定空结构 |
| `/api/runs/[id]` | GET | API-05 状态机字段；API-06 不存在 → 404 |
| `/api/settings` | GET/POST | API-12 只回掩码不泄明文；API-13 空 body 不写入 |

**不覆盖（明确出范围）**

- `analyze` 的**成功路径**（会派生 detached worker 子进程并真实写库）—— 只测 404 分支；成功路径由 `npm run regression` / `scripts/verify/c-loop.ts` 覆盖
- `/api/projects` POST 的 **zip 导入成功路径**（需构造 zip 文件；已由 `scripts/verify/t6-zip.ts` 覆盖）
- LLM 相关端点的**有数据形态**（`settings` 表 0 行，`src/lib/settings.ts:46` 密钥只写不读，测试无法构造）
- `/api/settings` POST 写入真实密钥（会污染 `data/app.db`）
- 并发、限流、鉴权（本项目为单机便携模式，无鉴权层）

## Decision Review Record

| 字段 | 内容 |
| --- | --- |
| 范围 | 11 个 Route Handler 的 16 条验收断言；只写测试代码与 Wiki，不改业务源码、不改 DDL |
| 事实证据 | 见「环境」「Seed-Setup」实测数据；断言锚点取自 11 个 `route.ts` 与 `src/lib/ingest.ts`、`src/lib/settings.ts` 原文行号 |
| Challenge | 若本计划是错误的，最可能错在：**只断言 HTTP 200 而不断言业务字段**——那样接口返回空壳也能过。核对方式：每条成功路径都断言业务值（`file_count=6`、证据 `file:line`↔`note` 精确配对、flow 六步文本逐条相等、settings 默认值），失败路径都断言具体文案与「不留库」 |
| 依赖与风险 | `A → B`：基线项目 `regression-fixture1` 存在 → 证据/业务流有数据。风险：`npm run regression` 的 cleanup 会**重建**项目、id 变化 → 故 beforeAll 按 slug 解析 id，**禁止硬编码** |
| 完整性 | §7 十项已过。无 NEED_CONFIRM：用户 m08762 已下达执行指令；范围由「补后端接口验收」自然限定 |
| 决策分类 | 测试代码 + 计划入库 = READY（m08762）；`api/API.md` 补建 = DEFERRED；analyze 成功路径自动化 = DEFERRED |
| 授权要求 | 生成测试源码并运行需「模式:执行」（已获，m08762 指令本身即执行要求）；写 `aidd-wiki/` 需「入库」（同批指令） |

## 环境

- 执行日期：2026-10-26
- Node v24.11.1 / npm 11.6.2
- `@playwright/test` **1.61.0**（复用本机 `C:\Users\26940\AppData\Local\ms-playwright\chromium-1228`，**未下载浏览器**）
- 被测应用：`http://127.0.0.1:4321`（`reuseExistingServer: true`）
- 断言载体：`@playwright/test` 的 `request`（`APIRequestContext`）做**真实 HTTP**——不新增依赖、不引 Java 框架、**不 Mock**
- 重要环境约束：`run_code` 内 `execSync`/`spawnSync('npx')` 一律拿不到输出（status null / EINVAL / stdout 仅 CRLF），`--reporter=json` 也不落文件；唯一有效方式是把输出重定向到文件再读

## Seed-Setup

不注入任何数据。基线由既有回归产物提供：

| 项目 | id（执行时） | slug | files | symbols | evidence | flows | flow_steps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 基线 | 37 | `regression-fixture1` | 6 | 3 | 3（`scan-v1`） | 2 | 9 |
| 空业务流对照 | 39 | `c-loop-fixture1` | 6 | 3 | 3（`scan-v2`） | **0** | 0 |

id 在用例中**按 slug 动态解析**（`beforeAll` → `GET /api/projects`），因为 cleanup 会重建项目。

## 数据生命周期

- 全部用例**只读**，除两条写入路径用例——它们都在校验阶段中止（`src/app/api/projects/route.ts:26/33`、`src/lib/ingest.ts:50` realpath 先于插入），因此**不产生任何行**
- API-13 用空 body POST `/api/settings`，前后各 GET 一次做全等比对，证明「不写入」
- API-15 追加「失败分支不留项目行」断言（`name === "be-api-probe"` 必须不存在）
- `keep_data: false`（无注入，无需清理）
- 执行后 DB 复核：`projects=2`、`settings=0`、`analysis_runs=3`、`files=12`、`integrity_check=ok` → **零残留**

## 场景与自动化适配度

| ID | 场景 | 关键失败路径？ | 自动化适配度 |
| --- | --- | --- | --- |
| API-01 | 项目清单与文件数 | 否 | 是 |
| API-02 | 单项目详情（project + stats + runs） | 否 | 是 |
| API-03 | 项目不存在 → 404 | **是** | 是 |
| API-04 | 预览：技术栈 + 端点 file:line | 否 | 是 |
| API-05 | 任务状态机字段 | 否 | 是 |
| API-06 | 任务不存在 → 404 | **是** | 是 |
| API-07 | 证据/符号精确配对 + 三徽标枚举 | 否 | 是 |
| API-08 | 版本过滤 + 幽灵版本不回落 | **是** | 是 |
| API-09 | 业务流与有序步骤 | 否 | 是 |
| API-10 | 无业务流项目返回空 | 否 | 是 |
| API-11 | 无 LLM 产物返回稳定空结构 | 否 | 是 |
| API-12 | 设置只回掩码、不泄明文 | **是**（安全） | 是 |
| API-13 | 设置空 body 不写入 | **是** | 是 |
| API-14 | 缺 name / 缺 path / slug 冲突 → 400 | **是** | 是 |
| API-15 | 路径不存在 → 400 且不落库 | **是** | 是 |
| API-16 | analyze 项目不存在 → 404 | **是** | 是 |

## 关键断言（优先证明业务状态）

1. **证据是「路径:行号 ↔ note」的精确配对**，不是「有几条记录」：`src/server/index.ts:7`↔`endpoint: GET /api/tasks`、`:12`↔`POST`、`:22`↔`PATCH`，且 `end_line === start_line`。
2. **业务流按 seq 严格连续**（前端按 seq 渲染序号圆点，断号即错），六步文本逐条相等，末步 `src/server/index.ts:18`。
3. **版本过滤不得回落**：`?version=ghost-v0` 必须返回空集，绝不能回落到 `scan-v1`（这是 D-2「证据跨版本堆积」的防线）。
4. **设置接口绝不回明文密钥**：响应不得出现 `apiKey` / `llm_api_key` 字段。
5. **失败分支不留副作用**：400/404 之后项目清单与设置快照必须与调用前全等。

## 不允许弱化的断言

| ID | 断言 | 为什么不可弱化 |
| --- | --- | --- |
| A1 | API-07 的三组 `file_path` + `start_line` + `note` 精确三元组 | 这是「结论可回溯源码证据」这条产品不变量（`aidd-wiki/_slots/project-invariants.md`）在接口层的唯一体现；放宽成「至少有一条证据」等于允许证据张冠李戴 |
| A2 | API-09 的六步文本逐条相等 + seq `[1,2,3,4,5,6]` | 业务流是「端到端可追踪」的交付物；只断言 `steps.length === 6` 无法发现步骤错位（本轮 `flows.ts` 就曾因响应步搜索窗口越界吃到下一 handler 的 `res.json`） |
| A3 | API-12 的 `not.toHaveProperty("apiKey")` 与 `not.toHaveProperty("llm_api_key")` | 密钥泄露是安全问题，不能因为「当前 settings 表为空所以不会泄露」就删掉——那是靠环境而不是靠代码 |
| A4 | API-08 的幽灵版本必须空集 | 若允许回落，跨版本证据会静默串台，且不会有任何报错 |
| A5 | API-15 的「不留项目行」 | 「写库前校验」是产品纪律；只断言 400 无法发现「先插入后回滚」的实现 |
| A6 | API-14 的 realpath 先于 slug 唯一性的**顺序契约** | 顺序决定报错语义与副作用；顺序反了会让「已存在 slug」的请求在无授权路径上先被拒，掩盖真实授权行为 |

## 人工检查项

| ID | 检查项 | 原因 |
| --- | --- | --- |
| M1 | `analyze` 成功路径（派生 worker、写 `analysis_runs`、状态流转到 `completed`） | 会起子进程并真实写库，不适合放进验收套件；由 `npm run regression` / `scripts/verify/c-loop.ts` 覆盖 |
| M2 | zip 导入成功路径（中文条目名） | 需构造 zip；已由 `scripts/verify/t6-zip.ts` 覆盖 |
| M3 | LLM 端点的有数据形态 | `settings` 0 行，无法构造；需人工填 Key 后走查 |
| M4 | 5 个只读端点对**不存在项目**返回 200 空结构（而非 404） | 见「验收缺口」第 1 条；当前是既有行为，未在本轮改变 |

## 契约建议（不改代码，仅记录）

- 5 个只读端点（`evidence` / `flows` / `nodes` / `terms` / `practice`）对不存在的项目返回 **200 + 空结构**，而 `projects/[id]`、`preview`、`analyze` 返回 **404**。语义不一致，但前端 `load()` 已按「非 ok 回退空对象」兜底，故不构成缺陷。若统一为 404，需同步改 `src/app/project/[id]/page.tsx:146-152`。
- `terms` 端点**不按版本过滤**（`terms` 以 `(project_id, slug)` 唯一、跨版本 upsert），与其余 4 个端点的版本口径不同。这是设计选择（见 [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]] 关键设计 6），已在本计划中显式记录以免被误判为缺陷。

## 验收缺口

1. **无 `api/API.md`**：be-test 闸门建议「涉接口时已有 API 文档」。本项目只有 `02-Design/standards/api.md`（通用标准）与 `_templates/API.md`（模板），无逐端点契约文档。→ 本轮以「11 个 `route.ts` 原文 + 实测响应」为事实源，缺口登记为 DEFERRED（补建需单独授权）。
2. **`map-pipeline/SPEC.md` 只有 AC-1**（缓存成本），与接口字段无直接对应。本计划的断言以代码与实测为准，不自行新增 SPEC。
3. `analyze` 成功路径、zip 成功路径、LLM 有数据形态三者未进自动化套件（见人工检查项 M1–M3）。

## 下一步

- 补 `api/API.md`（逐端点契约：路径、入参、成功/失败响应、错误码），使 be-test 闸门完整。
- 填 API Key 后补 LLM 端点的有数据断言。
- 若要自动化 `analyze` 成功路径，建议放到 `scripts/verify` 而非 `e2e/api`（那里已有 worker 生命周期控制能力）。

## 关联

| 产物 | 链接 |
| --- | --- |
| 执行记录 | [[05-Test-Tasks/BE-TEST-p1-api\|BE-TEST-p1-api]] |
| 开发任务 | [[04-Dev-Tasks/BE-evidence\|BE-evidence]] · [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]] |
| 测试代码 | `e2e/api/p1-api.spec.ts` · `playwright.config.ts` |
| 前端验收 | [[05-Test-Tasks/specs/FE-PW-PLAN-p1-loop\|FE-PW-PLAN-p1-loop]] · [[05-Test-Tasks/FE-TEST-p1-loop\|FE-TEST-p1-loop]] |
| 决策登记 | [[Decision-Register\|Decision-Register]] |
