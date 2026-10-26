---
project: proj-analysis-learner
type: dev-task
parent: "[[01-Requirements/modules/evidence/evidence|evidence]]"
date: 2026-10-25
status: done
phase: be-dev
batch: P0 收尾
---

# BE-evidence · 证据写入链路（symbols / evidence 落库）

## 目标

让「证据」真的进入产品数据模型：把 ts-morph 符号与静态端点/路由写入 `symbols` 与 `evidence` 表，使 P1 验收「用户从业务描述→真实代码→看到证据」具备数据基础。此前 13 张表全库零写入者（`src/` 仅 `llm_cache` 一处 INSERT，`scripts/` 仅 `regression_results` 一处）。

## 范围（Known Impact）

| 文件 | 改动 |
| --- | --- |
| `src/lib/evidence.ts`（新增） | `persistSymbols(projectId, symbols)`、`persistEvidence(projectId, analysisVersion, endpoints, routes)`，各自内部单事务 delete-then-insert，返回 `{ inserted, skipped }` |
| `worker/worker.ts` | 单阶段 scan → 三阶段 scan/symbols/evidence；启动改条件抢占；按 `run.stage` 决定起点 |
| `scripts/regression.ts` | cleanup 补删 symbols/evidence 并重排；端点过滤改用 `isTextFile`；新增落库 + 回读断言 |
| `scripts/verify/c-loop.ts`、`scripts/verify/t6-zip.ts` | cleanup 同序重排（先子表后 files，`foreign_keys=ON`） |
| `fixtures/fixture1-expected.json` | 增补 `symbolLocations`（不动既有 `symbols` 数组） |

**不做**：DDL 变更、LLM 证据与 claims、coverage_stats、失效传播、UI 改动（`src/app` 下 symbols/evidence 零引用，无可见界面变化，UI Quality Gate 不适用）。

## 关键设计

1. **符号写入口径**：`identify_by='ts-morph'`、`precision='exact'`；`file_id` 经 `files(project_id, path)` 反查（路径口径正斜杠相对路径，与 `worker.ts` walk 输出一致），查不到则跳过并计数（symbols.file_id NOT NULL）。
2. **证据写入口径**：`origin='static_analyzer'`、`processing='extracted'`、`freshness='current'`；端点 `note='endpoint: <METHOD> <path>'` 且 `start_line=end_line=line`；路由 `note='route: <path>'` 且行号留 NULL（`RouteInfo` 无 line）；`content_hash` 取同 run scan 阶段写入的 `files.content_hash` 快照，空串/NULL 一律写 NULL。
3. **幂等**：symbols 删除键 `project_id + identify_by='ts-morph'`（files 行永不删除，故不按 file_id 集合删）；evidence 删除键 `project_id + analysis_version + (note LIKE 'endpoint:%' OR note LIKE 'route:%')`，避免误删同版本其他来源证据。
4. **阶段与断点**：scan 仍按文件批次 checkpoint（`file:<n>/<total>`）；symbols/evidence 为一次性全量阶段，重跑时从阶段起点重做（覆盖写幂等）。三个阶段各自 heartbeat，避免长阻塞被 `recoverStaleRuns` 判为僵死。
5. **条件抢占**：`UPDATE analysis_runs SET status='running', stage=COALESCE(stage,?) WHERE id=? AND status IN ('queued','paused')`；影响 0 行即 `exit(0)`。修掉了原 `setRunStatus(runId,'running')` 在重复 spawn 时抛「非法状态转换 running→running」、被 catch 误标 failed 的缺陷。

## 执行记录

- 实现日期：2026-10-25
- `npm run typecheck` → 通过（无输出）
- `npm run regression` → `回归 PASS：fixture1 全部检查通过（symbols=3 evidence=3 skipped=0）`
- `npm run verify` → `小结：6/6 通过（fail=0）`；T3 仍 SKIP（settings 表 0 行，API Key 从未配置）
- `npx tsx scripts/verify/c-loop.ts` → C1/C2/C3a/C3b/C5 PASS，C4 SKIP；C3a 记录 `强杀后 status=running/step=file:2/6 → 恢复为 queued（recovery_count=1）`
- 真实仓库自测（导入本项目 1365 文件）：worker 5363ms，`stage=done`，`step=evidence:178/178`，`progress_note=files=1365 symbols=79 symbolsSkipped=0 evidence=6 evidenceSkipped=0`
- 抢占/续跑/终态自测：双 spawn 同一 run → `completed`（recovery_count=0，未误标 failed）；`stage='symbols'` 续跑 → `progress_note=symbols=3 symbolsSkipped=0 evidence=3 evidenceSkipped=0`（scan 被跳过）；对 `completed` 的 run 再 spawn → 保持 `completed`，无异常

## 待测清单

后端接口验收计划见 [[05-Test-Tasks/specs/BE-API-PLAN-p1-api|BE-API-PLAN-p1-api]]，执行记录见 [[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]]：**16 passed（3.6s）**，B1–B8 全 PASS。本节的清单是该计划的最小摘要，改接口时以此为准（改代码后须重跑 `npx playwright test e2e/api/p1-api.spec.ts`）。

| ID | 待测点 | 期望（可观测） | 依据 |
| --- | --- | --- | --- |
| B1 | 证据精确配对 | `GET /api/projects/<id>/evidence` 三条证据的 `file_path` + `start_line` + `note` 三元组精确对应 `src/server/index.ts:7/12/22` ↔ `endpoint: GET/POST/PATCH`，`end_line === start_line`，三徽标 `static_analyzer`/`extracted`/`current` | `src/lib/evidence.ts`、`src/app/api/projects/[id]/evidence/route.ts:26` |
| B2 | 版本过滤不回落 | `?version=scan-v1` 与缺省一致；`?version=ghost-v0` 返回空集（禁止回落到其它版本） | `evidence/route.ts:10-22`；[[Decision-Register\|D-2]] |
| B3 | 符号随版本 | `symbols` 按 `analysis_version` 过滤，3 条均 `precision='exact'` 且带 `file_path:line` | `evidence/route.ts:41` |
| B4 | 业务流有序 | `GET .../flows` 返回 2 条；post 6 步 `seq=[1..6]` 且六步文本逐条相等，末步 `src/server/index.ts:18` | `src/lib/flows.ts`、`flows/route.ts:33` |
| B5 | 预览端点可定位 | `GET .../preview` 的端点含 `src/server/index.ts:7/12/22`；6 文件全 `text_only` | `preview/route.ts:16-31` |
| B6 | 设置不泄密钥 | `GET /api/settings` 含默认值（`glm-4-flash`、`0.2`、`60000`），**不得出现 `apiKey` / `llm_api_key` 字段**；`POST {}` 前后快照全等 | `settings/route.ts`、`src/lib/settings.ts:11-17` |
| B7 | 写入前校验 | 缺 name / 缺 path → 400 具体文案；路径不存在 → 400 含 `ENOENT` 且**不留项目行**；slug 冲突 → 400 `slug 已存在` | `src/app/api/projects/route.ts:26/33`、`src/lib/ingest.ts:50/54` |
| B8 | 授权先于唯一性 | 假路径 + 已存在 slug 时，报错必须是 `ENOENT` 而不是 `slug 已存在`（顺序契约） | `src/lib/ingest.ts:50` 早于 `:54` |

基线：项目 **slug `regression-fixture1`**（执行时 id=37）；空业务流对照 **slug `c-loop-fixture1`**（id=39，`flows=0`）。**禁止硬编码 id**——`npm run regression` 的 cleanup 会重建项目。

不允许弱化的断言见计划文件「不允许弱化的断言」一节（A1–A6）。

## 延期与风险

- D-1 / D-2 / D-3 / U-1 见 [[Decision-Register|Decision-Register]]
- 观察项：evidence 行按 `analysis_version` 累积（每跑一次 scan 生成一个新版本），读取方必须带版本过滤；当前唯一读取方 `scripts/regression.ts` 已按版本过滤。

## 关联

| 产物 | 链接 |
| --- | --- |
| 需求 L1 | [[01-Requirements/modules/evidence/evidence\|evidence]] |
| 设计 | [[02-Design/modules/evidence/DES-evidence\|DES-evidence]] · [[02-Design/modules/analysis/DES-analysis\|DES-analysis]] |
| 代码 | [[03-Code/modules/analysis/BE-evidence\|BE-evidence（code）]] |
| 决策登记 | [[Decision-Register\|Decision-Register]] |

## 下一步

UI 侧尚无 symbols/evidence 读取方（`src/app` 零引用）。P1 的「证据卡」需先建读取 API 与展示组件。
