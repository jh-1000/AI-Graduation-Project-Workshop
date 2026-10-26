---
project: proj-analysis-learner
type: test-record
parent: "[[04-Dev-Tasks/BE-evidence|BE-evidence]]"
plan: "[[05-Test-Tasks/specs/BE-API-PLAN-p1-api|BE-API-PLAN-p1-api]]"
date: 2026-10-26
status: done
phase: be-test
point: BE-API-p1-api
engine: @playwright/test (npm) 1.61.0 · APIRequestContext
keep_data: false（未注入数据，无需清理）
---

# BE-TEST-p1-api · 后端接口验收执行记录

## 结论

**ready**。16 个用例全部通过（**16 passed / 3.6s**，EXIT=0）；两个负向对照分别得到 1 failed，证明断言非假阳性；执行前后 DB 零残留（`integrity_check=ok`）。

提交结论：可与已提交的 fe-test 批次并列进入 `/aidd:commit`。

## 关联

| 产物 | 链接 |
| --- | --- |
| 计划 | [[05-Test-Tasks/specs/BE-API-PLAN-p1-api\|BE-API-PLAN-p1-api]] |
| 开发任务 | [[04-Dev-Tasks/BE-evidence\|BE-evidence]]（证据写入链路）· [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]]（5 个只读端点） |
| 测试代码 | `e2e/api/p1-api.spec.ts`（314 行）· `playwright.config.ts` |
| 前端验收 | [[05-Test-Tasks/FE-TEST-p1-loop\|FE-TEST-p1-loop]]（6 passed） |
| 决策登记 | [[Decision-Register\|Decision-Register]] |

## 覆盖的场景与断言

| 用例 | 场景 | 结果 | 耗时 |
| --- | --- | --- | --- |
| API-01 | 项目清单 + `file_count=6` + `created_at` 格式 + id DESC 排序 | PASS | 32ms |
| API-02 | project + stats 合计 6 + `stack.languages` 含 javascript/typescript + runs ≤10 且有 completed scan | PASS | 107ms |
| API-03 | 项目不存在 → 404 + `项目不存在` | PASS | 40ms |
| API-04 | preview：6 文件全 `text_only` + 三端点 `src/server/index.ts:7/12/22` | PASS | 137ms |
| API-05 | runs：状态机六态 + kind 三值 + version/recovery_count/updated_at | PASS | 144ms |
| API-06 | 任务不存在 → 404 + `任务不存在` | PASS | 49ms |
| API-07 | evidence：三组 `file:line`↔`note` 精确配对 + 三徽标枚举 + 3 符号 `exact` + `file:line` | PASS | 124ms |
| API-08 | `?version=scan-v1` 与缺省一致；`ghost-v0` 返回空集（不回落） | PASS | 110ms |
| API-09 | flows：2 条；post 6 步 seq `[1..6]` 且六步文本逐条相等；patch 3 步末步 `index.ts:23` | PASS | 130ms |
| API-10 | 空业务流项目 `c-loop-fixture1` → `analysisVersion=null` + `[]` | PASS | 58ms |
| API-11 | nodes / terms / practice 稳定空结构 | PASS | 377ms |
| API-12 | settings 默认值 + **无明文 apiKey/llm_api_key** | PASS | 58ms |
| API-13 | POST settings 空 body 前后 GET 全等 | PASS | 94ms |
| API-14 | 缺 name / 缺 path / slug 冲突 → 400（含 realpath 先于唯一性的顺序契约） | PASS | 138ms |
| API-15 | 路径不存在 → 400 含 ENOENT 且不留项目行 | PASS | 59ms |
| API-16 | analyze 项目不存在 → 404 且不新建任务 | PASS | 149ms |

未自动化：M1 analyze 成功路径 / M2 zip 成功路径 / M3 LLM 有数据形态 / M4 只读端点的 404 语义不一致（见计划「人工检查项」与「验收缺口」）。

## 执行记录

- 执行日期：2026-10-26
- 命令：`cmd /c "npx --no-install playwright test e2e/api/p1-api.spec.ts --reporter=list > data\_be_out.txt 2> data\_be_err.txt"`
- 浏览器：chromium **149.0.7827.55**（复用 `chromium-1228` 缓存，**未下载**）
- 被测应用：`http://127.0.0.1:4321`（`reuseExistingServer: true`）
- 基线：按 `slug=regression-fixture1` 解析 id（执行时为 **37**）；空业务流对照 `slug=c-loop-fixture1`（**39**）
- 结果：**16 passed（3.6s）**，EXIT=0
- `node_modules/typescript/bin/tsc --noEmit` → **status 0**（`e2e/api/*.spec.ts` 落在 tsconfig include 内，无类型错误）

## 执行中修正的一条用例（如实记录）

首轮执行 **15 passed / 1 failed**：API-14 的 slug 冲突分支给的是假路径 `"x"`，报错为
`ENOENT: no such file or directory, lstat 'E:\da\项目分析学习系统\x'` 而非 `slug 已存在`。

- **失败分类：A（测试脚本缺陷）**，不是产品 Bug。
- 根因（读源码确认）：`src/lib/ingest.ts:50` 先 `fs.realpathSync(rawPath)` 做授权，`:54` 才查 `slug 已存在`。假路径必然先撞 ENOENT。
- 修法：slug 冲突分支改用 `process.cwd()`（真实存在的目录）以走到唯一性检查；**并把顺序契约单独钉住**——另加一条 `orderProbe`（假路径 + 已存在 slug 必须报 ENOENT 而不是 slug 冲突），使「授权先于唯一性」这条产品顺序被断言保护，而不是被绕过。
- 修后重跑：**16 passed（3.6s）**。

## 负向对照（证明断言非假阳性）

| 对照 | 改动 | 结果 | 失败原文 |
| --- | --- | --- | --- |
| A | API-07 证据行号 `7` → `8` | **1 failed** | `Error: 证据缺失：src/server/index.ts:8` / `Received: undefined` |
| B | API-12 `temperature` `0.2` → `0.9` | **1 failed** | `Expected: 0.9 / Received: 0.2` |

两次对照后均已还原（`git diff` 确认 spec 回到 `15529 bytes`，还原后复跑 **16 passed**）。

## 证据

控制台输出原文（执行期写入 `data/_be_out.txt`，批次收尾已清理；原文内联如下）：

```
Running 16 tests using 1 worker

  ok  1 [chromium] › e2e\api\p1-api.spec.ts:27:7 › BE-API · 项目与任务接口 › API-01 GET /api/projects 返回项目清单与文件数 (32ms)
  ok  2 … API-02 GET /api/projects/[id] 返回 project + stats + runs (107ms)
  ok  3 … API-03 GET /api/projects/[id] 不存在 → 404 且带 error 文案 (40ms)
  ok  4 … API-04 GET /api/projects/[id]/preview 返回技术栈与端点清单 (137ms)
  ok  5 … API-05 GET /api/runs/[id] 返回任务状态机字段 (144ms)
  ok  6 … API-06 GET /api/runs/[id] 不存在 → 404 (49ms)
  ok  7 … API-07 GET evidence 按版本返回证据与符号（含精确 file:line） (124ms)
  ok  8 … API-08 GET evidence?version 版本过滤生效且与缺省一致 (110ms)
  ok  9 … API-09 GET flows 返回业务流与有序步骤（seq 连续、末步可定位） (130ms)
  ok 10 … API-10 GET flows 对无业务流的项目返回空且不报错 (58ms)
  ok 11 … API-11 GET nodes / terms / practice 在无 LLM 产物时返回稳定空结构 (377ms)
  ok 12 … API-12 GET /api/settings 只回掩码、绝不回明文密钥 (58ms)
  ok 13 … API-13 POST /api/settings 空 body 不产生任何写入 (94ms)
  ok 14 … API-14 POST /api/projects 缺 name / 缺 path / slug 冲突 → 400 (138ms)
  ok 15 … API-15 POST /api/projects 路径不存在 → 400（realpath 阶段中止） (59ms)
  ok 16 … API-16 POST /api/projects/[id]/analyze 项目不存在 → 404 且不新建任务 (149ms)

  16 passed (3.6s)
```

负向对照失败原文（执行期写入 `data/_neg1.txt` / `data/_neg2.txt`，批次收尾已清理；原文内联如下）：

```
1) … API-07 GET evidence 按版本返回证据与符号（含精确 file:line）
   Error: 证据缺失：src/server/index.ts:8
   expect(received).toBeTruthy()
   Received: undefined
     > 141 |       expect(hit, `证据缺失：${file}:${line}`).toBeTruthy();

1) … API-12 GET /api/settings 只回掩码、绝不回明文密钥
   Error: expect(received).toBe(expected) // Object.is equality
   Expected: 0.9
   Received: 0.2
     > 252 |     expect(body.temperature).toBe(0.9);
```

## 数据生命周期复核

执行后只读探测（临时脚本与输出文件均已删除）：

| 项 | 值 | 判定 |
| --- | --- | --- |
| `projects` | 2（37 / 39） | 未被写入路径用例新增 |
| `settings` | 0 行 | API-13 未写入 |
| `analysis_runs` | 3 | API-16 未新建任务 |
| `files` | 12 | 未变 |
| `PRAGMA integrity_check` | `ok` | 库结构完好 |

## 已知缺口

1. **无 `api/API.md`** —— be-test 闸门建议项缺失，已 DEFERRED（见计划「验收缺口」）。
2. `analyze` 成功路径 / zip 成功路径 / LLM 有数据形态未进自动化（M1–M3）。
3. 5 个只读端点对不存在项目返回 200 空结构，与 `projects/[id]` 的 404 语义不一致（M4，既有行为，本轮未改）。

## 下一步

- 补 `api/API.md` 后，本计划的「来源」表可从「route.ts 原文」升级为「契约文档 + 实现」双源。
- 填 API Key 后补 LLM 端点有数据断言（当前 3 个端点只测了空结构）。
- `/aidd:commit`：把 `e2e/api/p1-api.spec.ts` 与本两份 Wiki 一并提交。
