---
project: proj-analysis-learner
type: release
phase: release
status: done
date: 2026-10-26
---

# REL — 2026-10-26（be-test 执行批次）

## 变更摘要

本批次 = `/aidd:be-test` 执行阶段产物 + 验收记录入库。承接 `[[04-Dev-Tasks/BE-evidence|BE-evidence]]`（证据写入链路，已 done）与 `[[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]]`（5 个只读端点，已 done），并闭环上一批次 `[[06-发布/REL-2026-10-26|REL-2026-10-26]]` 明确记为未做的 BE-TEST。

| 类别 | 内容 |
| --- | --- |
| 测试代码 | 新增 `e2e/api/p1-api.spec.ts`（314 行 / 16 用例 API-01–API-16），用 `@playwright/test` 的 `APIRequestContext` 打真实 HTTP；**未新增任何依赖**（复用 fe-test 批次的 `@playwright/test ^1.61.0`），无 Mock |
| 验收结果 | **16 passed（3.6s，EXIT=0）**；两个负向对照（API-07 证据行号 `7`→`8`、API-12 `temperature` `0.2`→`0.9`）各得 `1 failed`，证明断言非假阳性；全量套件（FE 6 + BE 16）**22 passed**，前端无回退；执行前后 DB 零残留 `integrity_check=ok` |
| 覆盖范围 | 11 个 Route Handler 全覆盖；重点钉住「证据 `file:line` ↔ `note` 精确配对」「flows 步骤 seq 连续且末步可定位」「settings 绝不回明文密钥」「realpath 授权先于 slug 唯一性」四条契约 |
| Wiki | 新建 `BE-TEST-p1-api`（执行记录）与 `specs/BE-API-PLAN-p1-api`（计划）；`BE-evidence` 补「待测清单」B1–B8；`05-Test-Tasks/README.md` Backend API Acceptance 行 pending→16 passed、Evidence 补实测 |
| 修正 | `REL-2026-10-26.md` 的「BE-TEST 未做」改为「在本批次提交时未做 + 已由本批次闭环」，消除一处已知为假的文档陈述；`05-Test-Tasks/README.md` 与 `BE-TEST-p1-api.md` 中指向已清理临时文件（`data/_neg1.txt` 等）的失效路径改为「原文内联」 |
| 其他 | `.gitignore` 增 `%SystemDrive%/`（项目根搜狗输入法空目录壳，内容已清空、被进程持句柄无法删除，避免每次 `git add` 打印 Permission denied 警告） |

## 首轮 15 passed / 1 failed 的处置（A 类测试脚本缺陷，非产品 Bug）

失败原文：`Expected substring: "slug 已存在"` / `Received string: "ENOENT: no such file or directory, lstat 'E:\da\项目分析学习系统\x'"`。

- 根因（读源码确认）：`src/lib/ingest.ts:50` 先 `fs.realpathSync(rawPath)` 做路径授权，`:54` 才检查 `slug 已存在`。假路径必然先撞 ENOENT。
- 修法：slug 冲突分支改用 `process.cwd()`（真实存在的目录）以走到唯一性检查；**并把顺序契约单独钉住** —— 新增 `orderProbe`（假路径 + 已存在 slug 必须报 ENOENT 而非 slug 冲突），使「授权先于唯一性」被断言保护，而不是被绕过。
- 修后重跑：**16 passed（3.6s）**。按 fe-test 的失败分类，这是 A 类（测试脚本缺陷），不是 B 类（产品 Bug）。

## 未覆盖 / 风险（明确记录）

- **无 `api/API.md`**：be-test 闸门建议项缺失，已 DEFERRED（见 `BE-API-PLAN-p1-api` 的「验收缺口」）。当前计划与断言的来源是 `src/app/api/**/route.ts` 原文，不是契约文档。
- **M1–M3 未自动化**：`analyze` 成功路径、zip 导入成功路径、LLM 有数据形态（nodes/terms/practice 非空）均未进用例。
- **M4 只读端点 404 语义不一致**：5 个只读端点对不存在项目返回 200 空结构，与 `/api/projects/[id]` 的 404 不一致。属既有行为，本轮按「不改产品代码」原则只记录不改。
- **S6 揭示交互仍未验证**：`practice_items=0`，需用户本人到设置页填 API Key 后重跑 map 才有数据。
- **LLM 三阶段有数据路径从未真实跑过**：`settings` 表 0 行；`src/lib/settings.ts:46` 的 `getApiKeyInternal` 只写不读，密钥只能用户本人填。
- 遗留 DEFERRED 不变：D-1 后半（symbols↔evidence 无连接键）、D-2（evidence 跨版本堆积）、D-3（证据未分阶段）、U-1 —— 见 `[[Decision-Register|Decision-Register]]`；重新评估条件不变。

## Commit

- 提交内容：`e2e/api/p1-api.spec.ts`、`aidd-wiki/05-Test-Tasks/specs/BE-API-PLAN-p1-api.md`、`aidd-wiki/05-Test-Tasks/BE-TEST-p1-api.md`、`aidd-wiki/04-Dev-Tasks/BE-evidence.md`、`aidd-wiki/05-Test-Tasks/README.md`、`aidd-wiki/log.md`、`aidd-wiki/06-发布/REL-2026-10-26.md`、`aidd-wiki/06-发布/REL-2026-10-26-be-test.md`、`aidd-wiki/index.md`、`.gitignore`。
- 提交信息风格沿用仓库既有 conventional commits（`test:` 前缀）。
- 推送：`main -> origin/main`（SSH，走 ssh.github.com:443 别名）。

## 关联

[[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]] · [[05-Test-Tasks/specs/BE-API-PLAN-p1-api|BE-API-PLAN-p1-api]] · [[04-Dev-Tasks/BE-evidence|BE-evidence]] · [[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]] · [[06-发布/REL-2026-10-26|REL-2026-10-26]] · [[Decision-Register|Decision-Register]]
