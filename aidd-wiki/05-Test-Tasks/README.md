---
project: proj-analysis-learner
type: test-tasks
date: 2026-10-29
---

# Test Tasks

## Frontend Acceptance

| Point | Plan | Result | Status |
|-------|------|--------|--------|
| [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]] | [[05-Test-Tasks/specs/FE-PW-PLAN-p1-loop\|FE-PW-PLAN-p1-loop]]（已执行） | [[05-Test-Tasks/FE-TEST-p1-loop\|FE-TEST-p1-loop]] | 7 passed（S1–S5、S7、S8 结论层）；S6 因 practice_items=0 未自动化 |

## Backend API Acceptance

| Point | Plan | Result | Status |
|-------|------|--------|--------|
| [[04-Dev-Tasks/BE-evidence\|BE-evidence]] · [[04-Dev-Tasks/BE-claims\|BE-claims]] | [[05-Test-Tasks/specs/BE-API-PLAN-p1-api\|BE-API-PLAN-p1-api]]（已执行） | [[05-Test-Tasks/BE-TEST-p1-api\|BE-TEST-p1-api]] | 17 passed（API-01–API-17，含结论层）；analyze/zip 成功路径与 LLM 有数据形态留在人工检查项 |

## Evidence

- Playwright reports / traces / screenshots: `npx --no-install playwright test --reporter=list` 输出 `6 passed (14.4s)`（EXIT=0），负向对照产出 `test-results\…S3…\test-failed-1.png` 与 `trace.zip`；HTML 报告未另存（`playwright-report/` 已 gitignore）
- 后端接口验收（本项目无 Java 服务，用 @playwright/test 的 request 上下文做真实 HTTP）：`npx --no-install playwright test e2e/api/p1-api.spec.ts --reporter=list` → `16 passed (3.6s)`（EXIT=0）；负向对照两次各得 1 failed（证据行号 7→8、temperature 0.2→0.9），失败原文已内联于 [[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]] 的「负向对照」节（执行期临时文件 `data/_neg1.txt` / `data/_neg2.txt` 已在批次收尾清理）；执行后 DB 复核 `projects=2 / settings=0 / analysis_runs=3 / integrity_check=ok` 零残留
- 结论层批次（P1 结论层）：全量 24 用例 `24 passed (40.9s)`（EXIT=0），含新增 API-17 与 S8；两次负向对照各得 1 failed（A：review_state 恒 supported → regression FAIL(2) + S8 1 failed；B：跳过端点结论 → regression FAIL(4) + API-17 1 failed），失败原文内联于 [[04-Dev-Tasks/BE-claims\|BE-claims]]「执行记录」；库内终态 `claims=3（draft 2 / supported 1）、claim_evidence=3`，`integrity_check=ok`、`foreign_key_check` 0 行
- 六维覆盖报告修复批（2026-10-29，[[04-Dev-Tasks/BE-coverage-report\|BE-coverage-report]]）：`npm run typecheck` ✓；真实库一次性版本注入验证（2 依赖 + 1 端点 + 1 路由 → external_deps 2/2、flows 分母排除依赖行、claims 0 条 dep 结论，验证数据已清理）；`npm run regression` **PASS**（claims=3 links=3 skipped=0）；e2e 现有 27 用例不断言 coverage/lockfile，未跑全量。10-29 学习升级批（probe/alternatives/techpath/followup）无自动化用例，E2E 27/27 属阶段自述未复核（[[06-发布/REL-2026-10-29-learning-upgrades\|REL-2026-10-29]]）
