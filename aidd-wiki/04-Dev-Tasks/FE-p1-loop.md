---
project: proj-analysis-learner
type: dev-task
parent: "[[01-Requirements/modules/analysis/map-pipeline/map-pipeline|map-pipeline]]"
date: 2026-10-25
status: done
phase: fe-dev
batch: P1 最小闭环
---

# FE-p1-loop · P1 最小闭环（业务流 / 证据卡 / 节点 / 术语 / 练习）

## 目标

让 P1 验收「用户从业务描述 → 真实代码 → 看到证据 → 完成学习 → 独立定位一问题」在真实 Next.js 页面上可见。此前证据已写进库（`symbols` / `evidence`），但 `src/app` 下对这两张表零引用，页面上看不到任何证据，验收物理上无法达成。

## 范围（Known Impact）

| 文件 | 改动 |
| --- | --- |
| `src/lib/db/migrations/0002_map_learning.sql`（新增） | `ALTER TABLE symbols ADD COLUMN analysis_version`；建 `nodes` / `flows` / `flow_steps` / `repo_insights` / `history_events` / `practice_items` 六张表 |
| `src/lib/flows.ts`（新增） | `detectFlows`（确定性业务流程追踪）/ `persistFlows`（单事务 delete-then-insert） |
| `src/lib/llm/analyze.ts`（新增） | `analyzeNodes` / `analyzeTerms` / `analyzePractice`；无 API Key 时写 `open_questions` 并返回空，绝不抛异常 |
| `src/lib/llm/client.ts` | `chatJSON` 接 `buildContext`，新增 `context` / `maxContextChars` 选项与 `OutboundTrace` 返回值 |
| `src/lib/evidence.ts` | `persistSymbols` 增 `analysisVersion` 参数，写入与删除键都带版本 |
| `src/lib/db/index.ts` | 新增 `deleteProjectData(projectId)`，脚本与测试统一清理 |
| `worker/worker.ts` | 两条阶段链：scan 链 `scan→symbols→evidence`；map 链 `symbols→evidence→flows→nodes→terms→practice` |
| `src/app/api/projects/[id]/analyze/route.ts` | 接受 `kind`（`scan` / `map`，缺省 `scan`） |
| `src/app/api/projects/[id]/{evidence,flows,nodes,terms,practice}/route.ts`（新增） | 5 个只读端点 |
| `src/app/project/[id]/page.tsx` | 新增证据卡 / 业务流程 / 知识节点 / 术语卡片 / 自测题与定位挑战五个区块 |
| `scripts/regression.ts`、`scripts/verify/{c-loop,t6-zip}.ts` | 统一走 `deleteProjectData`；regression 增 flows 与 symbols 版本断言 |
| `fixtures/fixture1-expected.json` | 增补 `flows`（`post-api-tasks` 6 步 / `patch-api-tasks` 3 步） |

**不做**：`claims` / `claim_evidence` / `edges` / `coverage_stats` 写入、失效传播、git 考古、FSRS 复习调度、能力雷达、答辩与挑战模块、lockfile 解析。

## 关键设计

1. **两条阶段链**：`kind='scan'` 走 `scan → symbols → evidence`（保持 P0 行为不变）；`kind='map'` 走 `symbols → evidence → flows → nodes → terms → practice`（不重扫文件，复用已落库的 `files.content_hash`）。两条链共用同一张 `analysis_runs.stage` 做断点位置，起点规则 = 当前 stage 在链中的下标。
2. **业务流程走确定性追踪，不用模型**：`src/lib/flows.ts` 从 MUTATING 端点（POST/PUT/PATCH/DELETE）出发，按「前端事件 → handler → 请求 → 服务端端点 → 数据表 → 响应」六类锚点用正则定位，每条锚点都带 `file:line`。理由：fixture 的期望业务流本身就是这条链的可推导结果，走确定性路径可以让业务流在**没有 API Key 时也能产出**，P1 的核心可见交付不依赖外部服务。会推翻它的条件：业务流需要跨语言/跨进程调用链（例如 Python 服务调 Node 服务）时正则做不到，必须换模型。
3. **无 Key 降级是硬要求**：`settings` 表实测 0 行，`chatJSON` 在无 Key 时抛错。`analyze.ts` 把「无 Key / 调用失败 / zod 校验失败」统一降级为「写一条 `open_questions` 并返回空结果」，节点/术语/练习三个区块显示为空，证据卡与业务流程照常可见。降级不是失败，是设计内状态。
4. **UI 代码落 `src/app` 而非 `output/fe-demo`**：`standards/ui.md:22-27` 的默认约定是「UI 文档 + Demo 代码同一轮」，但本项目真实交付物是 Next.js 应用，`output/fe-demo/index.html` 是设计原型。按「项目 Artifact 优先于 Skill 模板默认」，`UI.md` 的 `fe_demo_file` 指向真实页面 `src/app/project/[id]/page.tsx`，`fe_demo_route` 写 `/project/[id]`。
5. **三总状态不互相冒充**：页头保留琥珀徽标「初步清单 · 不代表完整分析」；证据行分别显示 `origin` / `processing` / `freshness` 三个徽标；节点与练习显示 `draft` / `pending_review` / `confirmed` 状态徽标。任一区块为空时给出「为什么空」的说明（尚无证据 / 需模型生成），不用空列表冒充「已完成」。
6. **版本过滤口径**：`evidence` / `flows` / `nodes` / `practice_items` 都带 `analysis_version`，读取端点按版本取最新一份；`terms` 以 `(project_id, slug)` 唯一并跨版本 upsert，因此不按版本过滤。

## 执行记录

- 实现日期：2026-10-25
- `npm run typecheck` → 通过（无输出）
- `npm run regression` → `回归 PASS：fixture1 全部检查通过（symbols=3 evidence=3 flows=2 steps=9 skipped=0）`
- `npm run verify` → `小结：6/6 通过（fail=0）`；T3 仍 SKIP（未配置 API Key）
- `npx tsx scripts/verify/c-loop.ts` → C1/C2/C3a/C3b/C5 PASS、C4 SKIP、`C 组闭环：全部通过`
- 真实仓库 map 自测（导入本项目 1385 文件）：worker 2872ms，`stage=done`、`step=practice:done`、`progress_note=symbols=101 symbolsSkipped=0 evidence=6 evidenceSkipped=0 flows=2 flowsSkipped=0 nodes=0 terms=0 practice=0`；`open_questions` 记录「nodes 阶段未执行：未配置 API Key」
- 5 个只读端点实测均 200：`evidence` 返回 `{evidence:3, symbols:3, analysisVersion:"scan-v1"}`；`flows` 返回 2 条（`post-api-tasks` 6 步，末步 `src/server/index.ts:18`）；`nodes` / `terms` / `practice` 空数组（无 Key）
- 自测发现并修掉 3 个缺陷：① 真实仓库多个同名端点导致 `flows` UNIQUE 冲突（`detectFlows` 与 `persistFlows` 双层按 slug 去重）；② map 链初版漏 `symbols` 阶段（跑 map 后 symbols=0，已补）；③ `evidence` 端点的 symbols 查询未按版本过滤（symbols 加版本列后会跨版本混读，已加 `AND s.analysis_version = ?`）

## 延期与风险

- D-1 已部分解决：`symbols` 现在有 `analysis_version` 列并随 run 写入；仍未解决的是 `symbols` 与 `evidence` 之间没有连接键（见 [[Decision-Register|Decision-Register]]）。
- D-2 / D-3 / U-1 状态不变。
- **既有阻塞已解除**：`npm run build` / `npm run dev` 原先失败于 `Failed to load next.config.ts` → `Cannot read properties of undefined (reading 'fileExists')`，根因是 `typescript@7.0.2` 是原生编译器、不提供 Next 需要的 JS compiler API（`ts.sys` 为 `undefined`）。已把 `typescript` 降到 **6.0.3**（`package.json` 与 lockfile 同步变更），`npm run build` 与 `npm run dev` 现均实测通过。
- **降级后暴露并修掉的构建错误**：`analyze/route.ts` 原用 `require.resolve("tsx/cli")`，webpack 顺着 `tsx/dist/cli.mjs` → `esbuild/lib/main.js` → `esbuild/lib/main.d.ts` 把 `.d.ts` 交给 next-swc-loader，报 `Module parse failed: Unexpected token (1:7)`；改用 `serverExternalPackages: ["better-sqlite3","tsx"]` 则报 `Module not found: ESM packages (tsx/cli) need to be imported`。最终改为 `resolveTsxCli()` 按路径拼 `node_modules/tsx/dist/cli.mjs`（回退 `cli.cjs`），不引入打包图，构建通过。
- **浏览器实机走查（`/project/35`，fixture1）**：`npm run dev` 起在 4321 端口，首页可加载；项目页经「启动完整分析（map）」跑出 `map-v1 completed / step=practice:done`，证据卡（3 条端点证据 + 3 个符号 chip）、业务流程（`post-api-tasks` 6 步 / `patch-api-tasks` 3 步，行号与库内一致）正常渲染；节点/术语/练习三区块正确显示「需模型生成」空态。
- **走查中发现并修掉的前端崩溃**：访问不存在的项目（`/project/9999`）时页面整页报 `Application error: a client-side exception has occurred`。原因 `load()` 未检查 `res.ok`，把 `{ error: "项目不存在" }` 当成数据塞进 `setPreview`，随后 `preview.stack.languages` 抛 TypeError。已改为：preview 非 2xx 时置 `fatal` 并渲染提示文案，其余 5 个端点非 2xx 时回退为空对象。

## 关联

| 产物 | 链接 |
| --- | --- |
| 需求 | [[01-Requirements/modules/analysis/map-pipeline/map-pipeline\|map-pipeline]] · [[01-Requirements/modules/learning/practice/practice\|practice]] · [[01-Requirements/modules/learning/terms/terms\|terms]] |
| 设计 | [[02-Design/modules/analysis/DES-analysis\|DES-analysis]] · [[02-Design/modules/evidence/DES-evidence\|DES-evidence]] |
| UI | [[02-Design/modules/analysis/ui/p1-loop/UI\|UI]] |
| 代码 | [[03-Code/modules/analysis/BE-p1-loop\|BE-p1-loop（code）]] |
| 决策登记 | [[Decision-Register\|Decision-Register]] |

## 下一步

- 填 API Key 后重跑 map，验证 `nodes` / `terms` / `practice` 三个 LLM 阶段的真实产出与 `open_questions` 清空。
- 实机走查目前只覆盖 fixture1 单项目，待补：大仓库（1385 文件）页面渲染、窄屏、以及 5 个只读端点各自的失败态。
- 未做：`claims` / `edges` / `coverage_stats` 写入与失效传播（P2）。