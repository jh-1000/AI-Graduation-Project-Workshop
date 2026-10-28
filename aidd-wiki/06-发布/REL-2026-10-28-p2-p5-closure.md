---
project: proj-analysis-learner
type: release
phase: release
status: done
date: 2026-10-28
---

# REL — 2026-10-28（P1 结论层 / IA 重建 / P2 / P3–P5 / 导入噪音修复 · 已入库）

> 本 REL 补 `log.md` 已记录但 `06-发布/` 缺失的发布说明。**已入库**：本 REL 覆盖的五个批次与 REL-2026-10-29 批次合并为单提交 `c253fe9`（2026-10-29，拆分原因见 § Commit）。原 draft 时的保留意见仍成立：**四个批次无独立测试记录**，验收覆盖不全；`log.md` 2026-10-28 07:47 的「项目完成」按本文件口径理解为：**实现完成 + build/类型已独立验证 + 验收覆盖不全**。

## 发布候选与范围

- 基线：`a4b044f`（= `origin/main`，`git rev-list --left-right --count HEAD...origin/main` = `0 0`，无 stash、仅 `main` 分支）
- 范围：`a4b044f..工作树` = **38 个已跟踪文件修改（+2031 / −1081）+ 74 个未跟踪新文件**
- 版本：`package.json` `version = 0.1.0`（未 bump，本批次不动版本号）
- 覆盖 `log.md` 五个批次：10-27 00:00 BE-claims → 10-27 13:11 fe-dev IA 重建 → 10-27 23:20 P2 → 10-28 07:41/07:47 P3/P4/P5 收官 → 10-28 08:32 fix 导入噪音

## 变更列表

| 批次 | 内容 | 代码落点 | 开发笔记 | 测试记录 |
| --- | --- | --- | --- | --- |
| P1 结论层 | claims / claim_evidence 写入者（按版本整体替换）、/claims 只读端点、项目页结论层区块、deleteProjectData 补删子表 | `/src/lib/claims.ts` · `src/app/api/projects/[id]/claims/route.ts` | [[04-Dev-Tasks/BE-claims\|BE-claims]] | API-17 · S8 已验收 |
| IA 重建 | 11 页迁入 /project/[id]/（消除硬编码 project 44）、项目侧栏 + 专注模式、图谱 2D/3D 力导向、流程线四动作 + 反追踪、知识点十段 + 寓言卡、知识库双视图 + FSRS、答辩双轴评分 + 阶梯提示 + 复述终局 | `src/app/project/[id]/**`（layout + graph/mastery/file/fable/defend 等） · 对应新 API | **缺笔记**（本轮登记为缺口） | 阶段自述 T 6/6 · E2E 27/27，本轮未复核 |
| P2 可靠底座 | token 计量 + 预算上限（超限降级开放问题）、/api/stats 统计与清缓存、变更影响页、体检与演进页（git 考古时间线）、flows 版本过滤 | `src/app/api/stats/route.ts` · `[id]/impact` · `[id]/invalidate` · `[id]/insights` · `src/lib/{audit,gitlog,coverage,invalidation}.ts` | **缺笔记** | 阶段自述 E2E 27/27 · 回归 PASS；失效传播自述端到端实测（1 文件→3 证据 stale→3 结论 flagged） |
| P3–P5 收官 | P3 练习闭环/任务书/混淆卡/全局助手/语音作答；P4 改码双轨隔离/破坏实验/运行验证/冲刺；P5 图谱失效视图/双导出（Obsidian wiki + 答辩速查包）/多语言符号 | `src/lib/{challenge,dualcheck,repomap,symbols-multi,edges,lockfile}.ts` · `ask/attempts/challenge/defend/export×2/practice/nodes/preview` 等路由 · `migrations/0004`0006` · `src/app/FolderBrowser.tsx` · `src/components/AppShell.tsx` | **缺笔记** | 阶段自述 E2E 27/27 + build ✓；build 已由本轮独立复现 |
| 导入噪音修复 | NOISE_DIRS 补 14 项（含 .npm-cache / data / aidd-wiki）、NOISE_EXTS 过滤二进制与日志、%SystemDrive% 残留过滤、浏览 API per-entry 容错、项目删除按钮 + DELETE API | `src/lib/ingest.ts:8,18,160,175` · `src/app/api/browse/route.ts` · `src/app/api/projects/[id]/route.ts:94` | **缺笔记** | 无 |

## DDL / migration

| 文件 | 新表 | 内容 | 版本控制状态 |
| --- | --- | --- | --- |
| `0003_evidence_stage_symbol.sql` | 0（+2 ALTER / 1 索引） | `evidence.symbol_id`、`evidence.stage`、`idx_evidence_stage` | **未入库** |
| `0004_node_mastery.sql` | 1（node_mastery） | FSRS 复习调度 | **未入库** |
| `0005_learning_attempts.sql` | 1（learning_attempts） | 练习作答记录 | **未入库** |
| `0006_challenge.sql` | 5（challenges / challenge_runs / runtime_proofs / fact_conflicts / user_corrections） | 实战挑战与破坏实验 | **未入库** |

- 累计 `CREATE TABLE` = **32**；live `data/app.db` 的 `sqlite_master` 实测同为 **32** → migration 与本机库状态一致。
- **风险**：`git log` 中不存在任何 migration 提交 → 这 4 个文件从未进版本控制，各环境库只在各自本机应用过。新环境按文件名顺序重放可重建；**回滚方案未定义**（SQLite 的 `ALTER TABLE ... ADD COLUMN` 撤销需重建表）。

## 验证证据（本轮独立复现，不沿用阶段自述）

| 项 | 命令 / 方法 | 结果 |
| --- | --- | --- |
| 生产构建 | `npm run build`（next 15.5.28） | ✓ Compiled successfully in 10.8s（总 47.2s）；26 个 API 路由 + 15 页全部编译，9 静态页生成 → `log.md` 的 `build ✓` **成立** |
| 类型检查 | `npx tsc --noEmit` | 空输出、2.6s → 类型层干净 |
| 库与迁移一致性 | migration 累加 vs `sqlite_master` | 32 = 32 |
| 密钥泄露 | 74 个未跟踪文件扫 sk-* / api_key= / Bearer / ghp_ | **0 命中**；`data/`（`app.db` + 17 个 `backup-t4-*.db` + 30+ 测试 zip）已被 `.gitignore:3` 忽略 |
| AI SDK 移除 | 全仓 `from "ai"` / `@ai-sdk` import | **0 命中**（D-5 移除结论成立；`node_modules` 残留目录不计） |
| Whisper 层 | 全仓 `whisper` 引用 | **0 命中**（D-7 推迟结论与代码一致）；原生 Web Speech 已实装 `src/app/project/[id]/defend/page.tsx:60-61` |

## 未覆盖 / 风险（明确记录，不得当已解决）

- **commit 闸门跳过并注明原因**：IA 重建 / P2 / P3 / P4 / P5 / 导入噪音修复 **均无 FE-TEST 或 BE-TEST 记录**。已有测试记录只覆盖 P1 闭环 —— [[05-Test-Tasks/FE-TEST-p1-loop|FE-TEST-p1-loop]]（7 passed：S1–S5、S7、S8）与 [[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]]（17 passed：API-01–17，覆盖 11 个 Handler）。当前 `src/app/api/**/route.ts` = **26** → **至少 15 个 Handler 无接口验收**（graph / mastery / file / fable / defend / challenge / ask / attempts / export×2 / practice / stats / nodes / invalidate / preview / browse / runs）。跳过原因：本轮目标是先补上实现与文档的断链、取得可复现基线；风险由「未入库状态本身无法回滚」放大，故列为本 REL 第一条开放风险。
- **本轮未重跑** T 套件 / 回归 / Playwright：需 `模式:执行` 授权，且会拉起 4321 dev server 并写 `data/`。其历史数字属阶段自述，未经本轮复核，不得写为已验证。
- **S6 与 LLM 有数据路径仍未验证（BLOCKED）**：`settings` 表 0 行；`src/lib/settings.ts:46` 的 `getApiKeyInternal` 只写不读，密钥只能用户本人在设置页填。解除条件不变。
- **D-2 重新评估条件已触发**：`src/app/api/projects/[id]/route.ts:61` 与 `src/app/api/projects/[id]/graph/route.ts:58` 读 `evidence` **不过滤 `analysis_version`**（同批其余 3 处读取方均过滤）→ 多 run 项目的项目页证据计数偏高、图谱失效视图可能跨版本误标。详见 [[Decision-Register|Decision-Register]] D-2。
- **D-3 仅部分缓解**：`0003` 已加 `stage` 列、`src/lib/lockfile.ts:33` 写 `stage='lockfile'`；但主写入方 `src/lib/evidence.ts:60` 的 INSERT 不含 `stage`（吃默认 `'static'`），`:57` 仍以 `note LIKE 'endpoint:%' | 'route:%'` 作删除判别键 → 前缀约定风险原样存在；migration 注释承诺的 `flow` / `llm` / `manual` 三值无生产者，`idx_evidence_stage` 目前只覆盖默认值。
- `api/API.md` 仍缺：新批次断言无契约真源（当前来源是 `route.ts` 原文）；M4 只读端点对不存在项目返回 200 空结构、与 `/api/projects/[id]` 的 404 不一致（既有行为，未改）。
- **开发笔记缺口**：5 个批次中 4 个无 `04-Dev-Tasks` 笔记，`03-Code/` 只有 P1 的 3 份。本 REL 是它们当前唯一的集中记录。
- **提交前抽查项**：`aidd-wiki/output/screens/*.png`（17 张 / 2.2MB，真实项目截图，可能含使用者不愿公开的目录名）。
- 遗留 DEFERRED 不变：D-2、D-3、D-4（`claim_dependencies` 仍无写入者，全仓 `INSERT INTO claim_dependencies` 0 命中）、D-5、D-6、D-7、U-1 —— 见 [[Decision-Register|Decision-Register]]。

## 双链索引

- 需求真源：[[01-Requirements/modules/analysis/repo-map/SPEC|repo-map SPEC]] · [[01-Requirements/modules/analysis/map-pipeline/SPEC|map-pipeline SPEC]] · [[01-Requirements/modules/evidence/invalidation/SPEC|invalidation SPEC]] · [[01-Requirements/modules/learning/practice/SPEC|practice SPEC]] · [[01-Requirements/modules/challenge/drill/SPEC|drill SPEC]] · [[01-Requirements/modules/regression/fixtures/SPEC|fixtures SPEC]]
- 设计真源：[[02-Design/modules/analysis/DES-analysis|DES-analysis]] · [[02-Design/modules/evidence/DES-evidence|DES-evidence]] · [[02-Design/modules/learning/DES-learning|DES-learning]] · [[02-Design/modules/challenge/DES-challenge|DES-challenge]] · [[02-Design/modules/platform/DES-platform|DES-platform]]
- UI：[[02-Design/modules/analysis/ui/p1-loop/UI|P1 闭环 UI]]（其余 7 个模块的 UI 细化未产出）
- 开发：[[04-Dev-Tasks/BE-claims|BE-claims]] · [[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]] · [[04-Dev-Tasks/BE-evidence|BE-evidence]]
- 测试：[[05-Test-Tasks/FE-TEST-p1-loop|FE-TEST-p1-loop]] · [[05-Test-Tasks/BE-TEST-p1-api|BE-TEST-p1-api]]
- 上一发布：[[06-发布/REL-2026-10-26-be-test|REL-2026-10-26-be-test]]
- 决策登记：[[Decision-Register|Decision-Register]]

## Commit

- **状态：已提交** —— `c253fe9`（2026-10-29，`feat: P2–P5 全功能落地（图谱/学习/答辩/挑战/双导出）+ 追问链与 6 项学习升级 + 0003–0007 migration`，88 文件 +8748/−1047）。
- **与拟议拆分的偏差（如实记录）**：原拟按 feat / fix / docs 拆三个提交，实际合并为一个 feat 提交——批次间文件级改动交叠（`worker.ts`、`claims.ts`、`defend`、`kb` 等同文件被多批先后修改），按文件拆分会提交与信息不符的中间态，按 hunk 拆分不可靠且无法保证每个中间态可编译。docs 部分单独见后续 docs 提交。
- 推送方式沿用既有：`main -> origin/main`（SSH，走 `ssh.github.com:443` 别名）；推送需另行授权。

