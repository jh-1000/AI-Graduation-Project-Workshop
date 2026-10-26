---
project: proj-analysis-learner
type: test-tasks
date: 2026-10-25
---

# Test Tasks

## Frontend Acceptance

| Point | Plan | Result | Status |
|-------|------|--------|--------|
| [[04-Dev-Tasks/FE-p1-loop\|FE-p1-loop]] | [[05-Test-Tasks/specs/FE-PW-PLAN-p1-loop\|FE-PW-PLAN-p1-loop]]（已执行） | [[05-Test-Tasks/FE-TEST-p1-loop\|FE-TEST-p1-loop]] | 6 passed（S1–S5、S7）；S6 因 practice_items=0 未自动化 |

## Backend API Acceptance

| Point | Plan | Result | Status |
|-------|------|--------|--------|
| [[04-Dev-Tasks/BE-evidence\|BE-evidence]] | [[05-Test-Tasks/specs/BE-API-PLAN-p1-api\|BE-API-PLAN-p1-api]]（已执行） | [[05-Test-Tasks/BE-TEST-p1-api\|BE-TEST-p1-api]] | 16 passed（API-01–API-16）；analyze/zip 成功路径与 LLM 有数据形态留在人工检查项 |

## Evidence

- Playwright reports / traces / screenshots: `npx --no-install playwright test --reporter=list` 输出 `6 passed (14.4s)`（EXIT=0），负向对照产出 `test-results\…S3…\test-failed-1.png` 与 `trace.zip`；HTML 报告未另存（`playwright-report/` 已 gitignore）
- 后端接口验收（本项目无 Java 服务，用 @playwright/test 的 request 上下文做真实 HTTP）：`npx --no-install playwright test e2e/api/p1-api.spec.ts --reporter=list` → `16 passed (3.6s)`（EXIT=0）；负向对照两次各得 1 failed（证据行号 7→8、temperature 0.2→0.9），失败原文已内联于 [[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]] 的「负向对照」节（执行期临时文件 `data/_neg1.txt` / `data/_neg2.txt` 已在批次收尾清理）；执行后 DB 复核 `projects=2 / settings=0 / analysis_runs=3 / integrity_check=ok` 零残留
