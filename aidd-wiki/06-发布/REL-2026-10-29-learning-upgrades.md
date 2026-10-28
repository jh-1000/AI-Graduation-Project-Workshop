---
project: proj-analysis-learner
type: release
phase: release
status: done
date: 2026-10-29
---

# REL — 2026-10-29（追问链 / 6 项学习升级 / 六维覆盖报告修复 · 已入库）

> 补 `log.md` 2026-10-29 三条批次（00:47 追问链 → 01:02 KB 页修复 → 01:09 六项学习升级）与本日 be-dev 修复批（六维覆盖报告）的发布说明。**已入库**：与 [[06-发布/REL-2026-10-28-p2-p5-closure|REL-2026-10-28]] 批次合并为单提交 `c253fe9`（2026-10-29，拆分原因见其 § Commit）。

## 发布候选与范围

- 基线：工作树（REL-2026-10-28 批次之上，仍以 `a4b044f` 为最后提交）
- 本 REL 覆盖四个批次：追问链（defend followup）· KB 页修复 · 6 项学习升级 · 六维覆盖报告修复
- 版本：`package.json` 0.1.0 未 bump
- 累计 API 路由 26 → **29**（新增 probe / alternatives / techpath），页面 14 → **15**（新增 radar），migration 0006 → **0007**

## 变更列表

| 批次 | 内容 | 代码落点 | 开发笔记 | 测试记录 |
| --- | --- | --- | --- | --- |
| 追问链 | defend API 新增 `action=followup`：LLM 基于回答缺口 + 证据动态生成追问（表层→原理→边界，最多 3 层），每层独立评分，链深度可追踪；UI 双轴评分后可触发 | `src/app/api/projects/[id]/defend/route.ts` · `defend/page.tsx` | [[04-Dev-Tasks/FE-learning-upgrades\|FE-learning-upgrades]] | 阶段自述 E2E 27/27（未复核） |
| KB 页修复 | KB 页被意外覆盖为雷达页 → 完整重写恢复：三视图 / 复习队列 / 术语弹层 / 混淆对比卡 | `src/app/project/[id]/kb/page.tsx` | 同上 | 阶段自述 |
| 6 项学习升级 | ①技术栈路径（DDL 0007 + techpath API + KB 视图）②影响探针（probe API + 知识点页）③换一种写法对比器（alternatives API + 知识点页）④追问链（见上）⑤复习卡加代码位置提示 + 证据锚点 ⑥技术栈雷达页 | `probe/alternatives/techpath` 三路由 · `0007_tech_path.sql` · `kb/node/radar` 三页 | [[04-Dev-Tasks/FE-learning-upgrades\|FE-learning-upgrades]] · [[03-Code/modules/learning/BE-learning-upgrades\|BE-learning-upgrades]] | 阶段自述 E2E 27/27（未复核）；四个新接口无 e2e 用例 |
| 六维覆盖报告修复 | symbols 维 SQL 括号；external_deps 从硬编码 0/0 改为读 `stage='lockfile'` 真实数据；flows/claims 口径排除依赖行；**MAP_STAGES 补 scan/lockfile**（文件解析 0/117 根因）；map 页阶段列表补两项并修 `module` key 错位 | `src/lib/coverage.ts` · `src/lib/claims.ts` · `worker/worker.ts` · `src/app/project/[id]/map/page.tsx` | [[04-Dev-Tasks/BE-coverage-report\|BE-coverage-report]] | **本轮独立复现**：typecheck ✓ · 真实库注入验证 ✓（验证数据已清理）· regression PASS |

## DDL / migration

| 文件 | 新表 | 内容 | 版本控制状态 |
| --- | --- | --- | --- |
| `0007_tech_path.sql` | 2（tech_paths / tech_path_items） | 技术栈学习路径（概念链 + 代码锚点 + 前置依赖） | **未入库**（与 0003–0006 同状态） |

## 验证证据（六维修复批为本轮独立复现；学习升级批为阶段自述，未复核）

| 项 | 命令 / 方法 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck` | ✓ 空输出 |
| 六维口径注入验证 | 真实库 + 一次性版本注入 2 依赖 + 1 端点 + 1 路由 → `runCoverage` + `persistClaims` | external_deps **2/2**；flows 分母排除依赖行；claims 0 条 dep 结论；验证数据已清理 |
| 回归 | `npm run regression` | **PASS**（claims=3 links=3 skipped=0） |
| 学习升级批 E2E | 阶段自述 `E2E 27/27` | **未由本轮复核**，不得写为已验证 |

## 未覆盖 / 风险（明确记录，不得当已解决）

- **未提交状态叠加**：本批叠在 REL-2026-10-28 的 38+74 文件未提交改动之上，两份 REL 共同构成待提交批次的完整说明；`git commit` 仍需用户明确授权。
- **probe / alternatives / techpath / followup 无接口验收**（与 LLM 有数据路径同属 S6 阻塞类）；probe 依赖 `allow_modify` 与目标项目 `node_modules`，e2e 可先覆盖「无验证命令 + not_run」降级分支。
- **D-3 缓解面扩大但未闭环**：读取方（claims/coverage）已切到 `stage` 列；主写入方 `evidence.ts` 的删除判别键仍为 note 前缀 → 见 [[Decision-Register|Decision-Register]] D-3 状态更新（2026-10-29）。
- **map 链补 scan 阶段的副作用**：map run 现在会重哈希全部文件（批间 80ms 延迟保留），大项目 map 耗时略增；断点续跑语义不变。旧版本 coverage_stats 不回填，报告数字以**下一次 map 产生的新版本**为准。
- lockfile 落库上限 200 → external_deps 封顶 200（[[04-Dev-Tasks/BE-coverage-report|BE-coverage-report]] § 已知限制）。
- UI 细化文档仍只有 [[02-Design/modules/analysis/ui/p1-loop/UI|P1 闭环 UI]] 一份；radar / KB techpath 视图 / 追问链交互未产出 UI.md（既有缺口延续）。

## 双链索引

- 需求真源：[[01-Requirements/modules/learning/learning|learning]] · [[01-Requirements/modules/defend/grill/SPEC|grill SPEC]] · [[01-Requirements/modules/evidence/coverage/SPEC|coverage SPEC]]
- 设计真源：[[02-Design/modules/learning/DES-learning|DES-learning]] · [[02-Design/modules/defend/DES-defend|DES-defend]]
- 开发：[[04-Dev-Tasks/FE-learning-upgrades|FE-learning-upgrades]] · [[04-Dev-Tasks/BE-coverage-report|BE-coverage-report]] · [[03-Code/modules/learning/BE-learning-upgrades|BE-learning-upgrades]]
- 决策登记：[[Decision-Register|Decision-Register]]（D-3 / D-8 关联）
- 上一发布：[[06-发布/REL-2026-10-28-p2-p5-closure|REL-2026-10-28-p2-p5-closure]]

## Commit

- **状态：已提交** —— `c253fe9`（2026-10-29），与 REL-2026-10-28 批次合并为单个 feat 提交（文件级改动交叠，拆分不可靠，见 [[06-发布/REL-2026-10-28-p2-p5-closure|REL-2026-10-28]] § Commit）。wiki 文档（本 REL 与批次笔记）单独走后续 docs 提交。
- 推送（`main -> origin/main`）需另行授权。
