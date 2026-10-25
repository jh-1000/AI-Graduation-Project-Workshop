# 软件项目分析学习系统

> `proj-analysis-learner` · v0.1.0 · 私有项目

给「能用 AI 做出项目、却说不清它怎么运行」的开发者：**导入一个项目 → 拆成可交互知识图谱与端到端业务流程线 → 学习闭环（讲解 / 主动回忆 / FSRS 复习 / 能力雷达）→ 答辩演练 → 实战挑战**。

每条结论都必须能回溯到源码证据；AI 只负责组织解释，不产生事实。

成功标准：用户不看答案能独立解释业务流程并定位代码。

---

## 当前状态：P0 收尾 + P1 数据与 UI 骨架

这是一个**可运行的骨架**，不是完成品。已经打通的与尚未打通的，都如实列在下面——请不要按 `aidd-wiki/output/fe-demo/` 里那份 1877 行的设计原型来预期当前 UI，那只是设计稿。

> **依赖说明**：`typescript` 已从 7.0.2 降到 **6.0.3**。TS 7 是原生编译器，不提供 Next.js 15 需要的 JS compiler API（`ts.sys` 为 `undefined`），会让 `next dev` / `next build` 在加载 `next.config.ts` 时直接失败（`Failed to load next.config.ts`）。降到 TS 6 后 `npm run build` 与 `npm run dev` 均已实测通过。若要回到 TS 7，需同时把 Next 升到 `>=16.2.11`。
>
> `src/app/api/projects/[id]/analyze/route.ts` 里的 `resolveTsxCli()` 按路径拼出 `node_modules/tsx/dist/cli.mjs`，而不是 `require.resolve("tsx/cli")`——后者会让 webpack 顺着 tsx → esbuild 把 `.d.ts` 打进 server bundle，构建必然失败。

### 已打通

| 能力 | 位置 |
|---|---|
| 项目导入（本地路径 / zip，含越界消毒、GBK 文件名、体积上限） | `src/lib/ingest.ts` |
| 技术栈识别、文本文件判定、端点与路由静态抽取 | `src/lib/scan.ts` |
| SQLite 迁移（`0001_init.sql` 19 张 + `0002_map_learning.sql` 6 张）、WAL + busy_timeout | `src/lib/db/` |
| 任务状态机（六状态、合法转换表、幂等键、心跳、超时重跑） | `src/lib/tasks.ts` |
| 独立 worker 子进程，两条阶段链（scan：scan→symbols→evidence；map：symbols→evidence→flows→nodes→terms→practice），断点续跑、分批、心跳、detached 派生、条件抢占 | `worker/worker.ts` |
| 符号与静态证据落库（ts-morph 符号 / 正则端点与路由 → `symbols`、`evidence`，均带 `analysis_version`） | `src/lib/evidence.ts` |
| 业务流程确定性追踪（端点 → handler → 请求 → 服务端 → 数据表 → 响应，六类锚点全部带 `file:line`，**不需要 API Key**） | `src/lib/flows.ts` |
| LLM 分析层（节点 / 术语 / 练习，三套 zod schema；无 Key 时写 `open_questions` 并降级为空，绝不抛异常） | `src/lib/llm/analyze.ts` |
| LLM 客户端（缓存 / 重试 / zod 校验 / JSON 容错）**已接入出站过滤器** | `src/lib/llm/client.ts` |
| 出站过滤器（敏感文件排除、密钥遮蔽、SSRF 校验） | `src/lib/llm/{outbound,ssrf}.ts` |
| Web UI：项目列表与导入、项目分析页（证据卡 / 业务流程 / 知识节点 / 术语 / 自测题 / 定位挑战）、设置页 | `src/app/` |
| 回归脚本 + T1–T6 技术验证 | `scripts/` |

### 尚未打通

- **LLM 阶段从未真实跑过**：`settings` 表 0 行，API Key 从未配置。节点 / 术语 / 练习三个区块在无 Key 时为空，并在 `open_questions` 记录原因——这是设计内降级，不是失败。
- **结论层仍是零写入者**：`claims` / `claim_evidence` / `claim_dependencies` / `edges` / `coverage_stats` / `repo_insights` / `history_events` 均无写入代码；`flow_steps.evidence_id` 与 `practice_items.evidence_id` 列已建但未写入。
- **失效传播未实现**：DES-evidence 点名的 `src/lib/invalidation.ts` 不存在；`symbols` 与 `evidence` 之间无连接键（见 `aidd-wiki/Decision-Register.md` D-1）。
- **Map 十阶段只实现了五段**：架构总览 / 模块深挖 / 建边 / 体检 / git 考古 / 双重校验 / 六维覆盖均未实现；选料用「取 loc 最大的 20 个已解析文件」而非 PageRank（`src/lib/repomap.ts` 不存在）。
- **P3–P5 表未建**：`node_mastery` / `learning_attempts` / `grill_sessions` / `challenges` / `challenge_runs` 等均无。
- **无 lockfile 解析**、`src/` 内未使用 tree-sitter（仅验证脚本使用）。
- **UI 只做过一次实机走查**：在 `/project/35`（fixture1 项目）上跑过一次 map，五个区块正常渲染；未做多项目、大仓库、窄屏与错误态的系统走查。

---

## 快速开始

```bash
npm install
npm run dev          # http://localhost:4321
npm run worker       # 另开一个终端：分析任务 worker（手动调试用，正常由 API 自动派生）
```

要求：**Node.js ≥ 20**（实测 v24.11.1 / npm 11.6.2）。`better-sqlite3` 是原生模块，Windows 下需要可用的构建工具链或预编译包。

首次使用：打开设置页填入 OpenAI 兼容 API Key（内置智谱 GLM / DeepSeek / 硅基流动 / 本地 Ollama 四个预设），再到首页导入一个项目目录或 zip。

---

## 脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器，端口 4321 |
| `npm run build` / `npm start` | 生产构建与启动 |
| `npm run worker` | 启动 worker 子进程（`tsx worker/worker.ts`） |
| `npm run typecheck` | `tsc --noEmit`，TypeScript strict |
| `npm run regression` | fixture1 回归：导入 → 扫描 → 符号/证据落库 → 业务流程追踪 → 任务恢复 |
| `npm run verify` | T1–T6 技术验证（tree-sitter / 并发 / LLM 结构化 / 备份 / SSRF / 中文 zip） |

`verify` 中 **T3 与 C4 在未配置 API Key 时为 SKIP**，不是通过。

---

## 架构

```
浏览器
  │  fetch
  ▼
Next.js 15 App Router（src/app/）
  │  仅做参数校验 + 派生 worker + 读库
  ▼
SQLite（data/app.db，WAL）
  ▲
  │  短事务写 + 心跳
worker 子进程（worker/worker.ts，detached）
  │
  └─ scan 链：ts-morph / 正则 → symbols / evidence
     map 链：确定性业务流 → LLM 节点 / 术语 / 练习（无 Key 降级）
```

设计要点：

- **便携模式**：全部状态只存应用目录相对的 `data/`，随目录拷贝即可迁移，不依赖注册表、固定安装路径或系统全局配置。
- **证据优先**：每条分析结论携带证据与 `analysis_version`；「任务完成 / 覆盖充分 / 结论已验证」三总状态独立展示，不互相冒充。
- **不执行被分析项目的脚本**；出站 LLM 请求必须先过出站过滤器。
- **SQLite 不做跨进程写协调者**：短事务（<100ms）+ `busy_timeout=5000` + BUSY 指数退避。

---

## 目录结构

```
src/app/            Next.js 页面与 API 路由（11 个 API、3 个页面）
src/lib/
  ingest.ts         路径 / zip 导入与安全校验
  scan.ts           技术栈识别、端点与路由抽取
  symbols.ts        ts-morph 符号抽取
  evidence.ts       符号与静态证据落库
  flows.ts          业务流程确定性追踪与落库
  tasks.ts          任务状态机、幂等键、心跳、恢复
  settings.ts       设置读写（密钥只写不读、掩码返回）
  db/               连接、迁移、0001_init.sql（19 张）+ 0002_map_learning.sql（6 张）
  llm/              client.ts（缓存/重试/zod/出站接线）、analyze.ts（节点/术语/练习 + 降级）、outbound.ts、ssrf.ts
worker/worker.ts    分析 worker（scan 链 3 阶段 / map 链 6 阶段）
scripts/            regression.ts + verify/（T1–T6 与 C 组闭环）
fixtures/           fixture1-todo-clip + fixture1-expected.json
aidd-wiki/          AIDD 方法论文档体系（需求 / 设计 / 标准 / 计划）
data/               运行时数据（git 忽略）：app.db、备份、workspaces
```

---

## 文档

- 项目定位与范围：`aidd-wiki/overview.md`
- 延期与不确定决策登记：`aidd-wiki/Decision-Register.md`
- 需求图谱（8 个 L1 模块 / 17 个 L3 点）：`aidd-wiki/01-Requirements/Requirements-Graph.md`
- 设计文档与规范：`aidd-wiki/02-Design/`
- **项目不变量（改动前必读）**：`aidd-wiki/_slots/project-invariants.md`
- 实施计划与路线图 P0–P5：`.zcode/plans/plan-session_a7417e0f0018398236c1c91cf6b6df52.md`
- 前端设计原型：`aidd-wiki/output/fe-demo/index.html`（双击即开的自包含单文件）

改文档请遵守 `aidd-wiki/AGENTS.md` 的约定（`raw/` 只读、`[[wikilinks]]`、`_pending/` 暂存后入库、每次入库追加 `log.md`）。

---

## 路线图

| 阶段 | 内容 |
|---|---|
| **P0**（已完成） | 技术验证 T1–T6、最小闭环 C1–C5、脚手架、导入、Scan 预览、fixture#1、回归雏形 |
| **P1**（数据与 UI 骨架已完成，待填 Key 验证 LLM 产出） | 一条真实业务流端到端追踪 + 证据卡 + 术语 chip + 一道自测题 + 一个定位挑战 |
| P2 | 分析底座：worker 持久化 / 幂等 / 预算 / 缓存 / 版本与失效传播 / 选料 / 整库引用图 / lockfile / 六维覆盖 / 双重校验 |
| P3 | 学习体验：讲解、主动回忆、FSRS 复习、能力雷达 |
| P4 | 答辩演练：一次一问、双轴评分、薄弱点报告 |
| P5 | 实战挑战：定位 / 隔离改码 / 破坏实验，全部可验证可回滚 |

---

## 非目标

多用户与登录、云部署、实时协作、IDE 插件、移动端、AI 理论课程、二进制逆向、向量库全库 RAG、CI 服务、消息队列 / 工作流引擎 / 独立治理平台。

---

## 许可

见 [LICENSE](LICENSE)。
