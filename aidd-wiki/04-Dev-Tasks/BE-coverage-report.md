---
project: proj-analysis-learner
type: dev-task
parent: "[[01-Requirements/modules/evidence/coverage/coverage|evidence/coverage]]"
date: 2026-10-29
status: done
phase: be-dev
batch: 六维覆盖报告修复
---

# BE-coverage-report · 六维覆盖报告修复（文件解析 / 外部依赖 / symbols 口径）

## 目标与根因

OV-04 六维覆盖报告跑完一次「完整分析（map）」后出现三处失真：

| 现象 | 根因 |
| --- | --- |
| 文件解析恒 0/117 | `parse_mode` 唯一升级点在 worker **scan 阶段**（`worker.ts:222`），但 `MAP_STAGES` 不含 scan；导入时所有文件写死 `text_only`（`ingest.ts:150`）且导入内联完成的 scan run 不经 worker → map 链跑完文件仍是 `text_only` |
| 外部依赖恒 0/0 | `coverage.ts` 硬编码插入 0/0（"P2 后续"），而 `runLockfileScan` 早已实现且 lockfile 阶段已在 scan 链——统计从未接上数据源，且 lockfile 阶段也不在 map 链 |
| 符号识别 204/90 溢出 | SQL 优先级 bug：`WHERE project_id = ? AND path LIKE '%.ts' OR path LIKE '%.tsx'` 缺括号，`.tsx` 跨项目统计；且该维分子（符号数）分母（TS 文件数）单位不同，溢出是口径使然而非 bug |

## 范围（Known Impact）

| 文件 | 动作 | 影响 |
| --- | --- | --- |
| `src/lib/coverage.ts` | 改 | ① symbols 维 LIKE 条件加括号；② flows 维 `evCount` 排除 `stage='lockfile'`；③ external_deps 改为统计 `stage='lockfile'` 证据行（`done=target`，与 references 维自比口径一致） |
| `src/lib/claims.ts` | 改 | 「未进入业务流」结论查询排除 `stage='lockfile'`（依赖行不是端点，不生成 `direct_extraction` 结论） |
| `worker/worker.ts` | 改 | `MAP_STAGES` 头部补 `scan`、`lockfile` 两阶段；头注释同步 |
| `src/app/project/[id]/map/page.tsx` | 改 | 阶段进度列表补 scan/lockfile 两项；修 `modules` → `module` key 错位（原导致模块深挖阶段进度高亮失效） |

## 关键设计

1. **过滤键用 `stage` 列而非 note 前缀**——遵循 0003 迁移「不再靠 note 前缀判定」的方向；evidence 仅两个写入方（persistEvidence 默认 `static`、lockfile 写 `lockfile`），`stage != 'lockfile'` 即端点/路由口径。
2. **map 链补 scan 阶段顺带激活快照核对**：evidence 阶段的快照比对（`run_files WHERE run_id = ?`）在 map run 下原本永远为空（无人为 map run 写 run_files），scan 阶段入链后计划 §4 的"分析期间文件变化 → 跳过证据抽取"才真正生效。
3. **幂等与断点不受影响**：scan 阶段对 map run 是 `UPDATE files ... WHERE path = ?`（无则 0 行）+ `INSERT OR REPLACE run_files`；断点续跑按 `run.stage` 起点，重试不会重跑已完成阶段。
4. **旧版本数据不回填**：coverage_stats 按版本整体替换，修复只影响**下一次** map 产生的新版本。

## 执行记录 / 验证

- `npm run typecheck` ✓（`tsc --noEmit` 空输出）。
- **真实库注入验证**（一次性版本 `zz-verify-tmp`，验证后已清理）：注入 2 条 lockfile 依赖 + 1 端点 + 1 路由 → external_deps **2/2**、flows 分母正确排除依赖行（2 而非 4）、claims 只为端点/路由生成结论（dep 行 0 结论）。
- `npm run regression` **PASS**（`claims=3 links=3 skipped=0`，与预期一致）。
- e2e 现有用例不断言 coverage/lockfile 行为，未跑全量。

## 已知限制（如实记录）

- lockfile 落库上限 200（`lockfile.ts:51` `deps.slice(0, 200)`）→ external_deps 封顶 200。
- `persistEvidence` 的删除判别键仍是 `note LIKE 'endpoint:%' | 'route:%'`（[[Decision-Register|D-3]] 未全解，本批只把**读取方**切到 stage）。
- 符号识别维分子/分母单位不同（符号数/文件数）属既有口径，UI 进度条会溢出，未在本批改动。
