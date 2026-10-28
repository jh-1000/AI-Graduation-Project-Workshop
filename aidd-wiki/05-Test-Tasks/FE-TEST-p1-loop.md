---
project: proj-analysis-learner
type: test-record
parent: "[[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]]"
plan: "[[05-Test-Tasks/specs/FE-PW-PLAN-p1-loop|FE-PW-PLAN-p1-loop]]"
date: 2026-10-26
status: done
phase: fe-test
point: FE-p1-loop
engine: @playwright/test (npm) 1.61.0
keep_data: false（本轮未注入数据，无需清理）
---

# FE-TEST-p1-loop · P1 最小闭环前端验收执行记录

## 结论

**ready**。6 个用例全部通过；负向对照（把 S3 末步 `src/server/index.ts:18` 改写成 `:999`）得到 1 failed，证明断言非假阳性。

提交结论：可以进入 `/aidd:commit`（详见文末「下一步」）。

## 关联

| 产物 | 链接 |
| --- | --- |
| 计划 | [[05-Test-Tasks/specs/FE-PW-PLAN-p1-loop\|FE-PW-PLAN-p1-loop]] |
| 开发任务 | [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]]（含待测清单 T1–T7） |
| UI 设计 | [[02-Design/modules/analysis/ui/p1-loop/UI\|UI]] |
| 需求 | [[01-Requirements/modules/analysis/map-pipeline/map-pipeline\|map-pipeline]] |
| 测试代码 | `e2e/p1-loop.spec.ts`、`playwright.config.ts` |

## 覆盖的场景与断言

| 用例 | 场景 | 结果 | 耗时 |
| --- | --- | --- | --- |
| S1 | 页头与三总状态声明（`项目分析` + `初步清单 · 不代表完整分析` + 返回链接） | PASS | 1.6s |
| S2 | 证据卡：三条证据 `file:line` 与 note 精确配对 + 三徽标；三个符号 chip 带 `file:line` | PASS | 2.7s |
| S3 | 业务流程：`业务流程（2）`；post-api-tasks 6 步 seq 1→6 末步 `src/server/index.ts:18`；patch-api-tasks 3 步 | PASS | 2.4s |
| S4 | 三区块空态必须说明「为什么空」（`API Key` / `需模型生成` 等） | PASS | 1.6s |
| S5 | 错误态：`项目 999999 不存在或已被删除`，且页面不含 `Application error`、`加载中…` | PASS | 2.4s |
| S7 | 版本一致性：evidence 端点 `analysisVersion=scan-v1`、evidence/symbols 各 3、带 `?version=` 一致、页面副标题同版本 | PASS | 1.9s |

未自动化：S6 揭示交互（`practice_items=0`，需填 API Key 后才有数据），保留在计划的人工检查项。

## 执行记录

- 执行日期：2026-10-26
- 命令：`npx --no-install playwright test --reporter=list`。注：run_code 内 `execSync` / `spawnSync` 一律拿不到输出（status null / EINVAL / stdout 仅 CRLF），`--reporter=json` 也不落文件；唯一有效方式是后台 pwsh 把输出重定向到 `data/_pw_*.txt` 再读文件。
- 浏览器：chromium **149.0.7827.55**，复用本机 `C:\Users\26940\AppData\Local\ms-playwright\chromium-1228` 缓存，**未下载任何浏览器**。
- 被测应用：`http://127.0.0.1:4321`（`reuseExistingServer: true`，复用已在跑的 dev server）。
- 基线：按 `slug=regression-fixture1` 解析出的 project id——**不硬编码**，因为 `npm run regression` 的 cleanup 会重建项目、id 会变。
- 结果：**6 passed（14.4s）**，EXIT=0。
- `npx tsc --noEmit`：通过（`e2e/*.spec.ts` 落在 tsconfig include 内，无类型错误）。

## 证据

控制台输出原文（`data/_pw_final.txt`）：

```
Running 6 tests using 1 worker

  ok 1 [chromium] › e2e\p1-loop.spec.ts:29:7 › P1 最小闭环 · 项目详情页五区块 › S1 页头与三总状态声明 (1.6s)
  ok 2 [chromium] › e2e\p1-loop.spec.ts:43:7 › … › S2 证据卡：证据行与符号 chip 都带可回溯的 file:line (2.7s)
  ok 3 [chromium] › e2e\p1-loop.spec.ts:81:7 › … › S3 业务流程：步数、顺序与每步 file:line (2.4s)
  ok 4 [chromium] › e2e\p1-loop.spec.ts:120:7 › … › S4 三区块空态必须说明「为什么空」 (1.6s)
  ok 5 [chromium] › e2e\p1-loop.spec.ts:141:7 › … › S5 错误态：不存在的项目不得整页崩溃 (2.4s)
  ok 6 [chromium] › e2e\p1-loop.spec.ts:151:7 › … › S7 版本一致性：页面副标题与 evidence 端点同版本 (1.9s)

  6 passed (14.4s)
EXIT=0
```

**负向对照**（证明 6 条通过不是空跑）：把 S3 末步断言 `src/server/index.ts:18` 改写成 `:999`，`-g S3` 单跑得 `1 failed`，报错原文：

```
Error: 第 6 步位置
Expected substring: "src/server/index.ts:999"
Received string:    "6返回响应src/server/index.ts:18"
```

同时产出 `test-results\…S3…\test-failed-1.png` 与 `trace.zip`；改回 `:18` 后重跑 → `6 passed`。

Playwright HTML 报告：本轮以 list reporter 输出为准，`playwright-report/` 未另存；`.gitignore` 已加 `playwright-report/` 与 `test-results/`。

## 数据生命周期

- 本轮**未创建、未注入任何测试数据**：只读取已存在的基线项目 `regression-fixture1`。
- `keep_data` 解析：无命令行 `--keep-data`；项目 `aidd-wiki/aidd.config.yml` **不存在**；技能默认 `false` → 按默认（清理）处理，且本就无注入数据。
- 跑测过程中**未点击**「启动扫描任务（scan）」/「启动完整分析（map）」按钮，避免写库与派生子进程。
- 执行后复核库内计数与执行前一致（project 37：`symbols=3 / evidence=3 / flows=2 / flow_steps=9`；`nodes/terms/practice_items=0`），**无残留数据**。

## 失败分类

本轮 0 失败，无需分类。后续若出现，按 A 测试脚本 / B 产品 Bug / C 环境 / D 验收缺口 四类归类。

## 已知缺口（不掩盖）

- **S6 揭示交互从未被验证**：`practice_items=0`。当前是「未验证」，不是「通过」。
- **LLM 三阶段（nodes / terms / practice）的有数据路径从未真实跑过**：`settings` 表 0 行，`src/lib/settings.ts:46` 密钥只写不读，我无法代填。
- **实机只覆盖 fixture1 单项目**：大仓库（1385 文件）、窄屏、5 个只读端点各自的失败态均未覆盖。
- `map-pipeline/SPEC.md` 只有 AC-1（缓存成本），没有覆盖五区块可见性的 AC —— 已记入计划「验收缺口」节，未自行新增 SPEC。

## 后续批次补充（claims 结论层，2026-10-27）

本记录描述的是 fe-test 批次当时的执行事实（**6 passed**）。后续 claims 结论层批次新增了 **S8**（结论层渲染与 supported/draft 不混同），用例数变为 **7**，全量套件（FE 7 + BE 17）为 **24 passed**。

- S8 断言：`section(page, /^结论层/)` 内 heading 含 `1 条 supported` 与 `2 条 draft`、`ul > li` 恰 3 条；流程结论条目含 `draft` / `inferred` / `src/server/index.ts:12`；端点结论条目含 `supported` / `direct_extraction` / `src/server/index.ts:7`。
- 负向对照（对照 A：把 `src/lib/claims.ts` 的 review_state 判定改成无条件 `supported`）→ `--grep S8` 得 1 failed，报错原文 `unexpected value "结论层3 条 supported · 0 条 draft（draft = 结论未被证据完整支撑）"` / `Expected substring: "1 条 supported"`。
- 本批次的执行细节与库内终态见 [[04-Dev-Tasks/BE-claims\|BE-claims]]。

## 下一步

1. 用户到设置页填 API Key → 重跑 map → 补 S6 与三区块有数据路径的断言。
2. 后端接口验收未做（`Backend API Acceptance` 仍 pending）→ `/aidd:be-test`。
3. 改动尚未提交（含 `package.json` / `package-lock.json` 依赖变更、`playwright.config.ts`、`e2e/p1-loop.spec.ts`、`.gitignore` 与 Wiki）→ `/aidd:commit`。
