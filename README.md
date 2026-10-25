# 软件项目分析学习系统

> `proj-analysis-learner` · v0.1.0 · 私有项目

给「能用 AI 做出项目、却说不清它怎么运行」的开发者：**导入一个项目 → 拆成可交互知识图谱与端到端业务流程线 → 学习闭环（讲解 / 主动回忆 / FSRS 复习 / 能力雷达）→ 答辩演练 → 实战挑战**。

每条结论都必须能回溯到源码证据；AI 只负责组织解释，不产生事实。

成功标准：用户不看答案能独立解释业务流程并定位代码。

---

## 当前状态：P0 骨架

这是一个**可运行的骨架**，不是完成品。已经打通的与尚未打通的，都如实列在下面——请不要按 `aidd-wiki/output/fe-demo/` 里那份 1877 行的设计原型来预期当前 UI，那只是设计稿。

### 已打通

| 能力 | 位置 |
|---|---|
| 项目导入（本地路径 / zip，含越界消毒、GBK 文件名、体积上限） | `src/lib/ingest.ts` |
| 技术栈识别、文本文件判定、端点与路由静态抽取 | `src/lib/scan.ts` |
| SQLite 迁移、19 张 P0 表、WAL + busy_timeout | `src/lib/db/` |
| 任务状态机（六状态、合法转换表、幂等键、心跳、超时重跑） | `src/lib/tasks.ts` |
| 独立 worker 子进程（断点续跑、分批、心跳、detached 派生） | `worker/worker.ts` |
| LLM 客户端（缓存 / 重试 / zod 校验 / JSON 容错） | `src/lib/llm/client.ts` |
| 出站过滤器（敏感文件排除、密钥遮蔽、SSRF 校验） | `src/lib/llm/{outbound,ssrf}.ts` |
| Web UI：项目列表与导入、Scan 预览、设置页 | `src/app/` |
| 回归脚本 + T1–T6 技术验证 | `scripts/` |

### 尚未打通

- **证据链未落库**：`symbols` / `evidence` / `claims` / `edges` / `terms` / `coverage_stats` 等 13 张表有 DDL 但**零写入者**。`extractSymbolsTs` 只在回归脚本里被调用，未接入产品路径。
- **LLM 链路未接线**：`chatJSON` 与 `buildContext` 均为孤儿代码（全库零调用点），出站过滤器尚未接入客户端。
- **worker 只有 scan 一个阶段**：设计文档里的 Map 十阶段流水线未实现。
- **DDL 缺 P1–P3 表**：`nodes` / `flows` / `flow_steps` / `node_mastery` / `grill_sessions` / `challenges` 等均未建。
- **无 lockfile 解析**、`src/` 内未使用 tree-sitter（仅验证脚本使用）。

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
| `npm run regression` | fixture1 回归：导入 → 扫描 → 符号抽取 → 任务恢复 |
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
  └─ 静态分析：ts-morph / web-tree-sitter / 正则；LLM 阶段（待接线）
```

设计要点：

- **便携模式**：全部状态只存应用目录相对的 `data/`，随目录拷贝即可迁移，不依赖注册表、固定安装路径或系统全局配置。
- **证据优先**：每条分析结论携带证据与 `analysis_version`；「任务完成 / 覆盖充分 / 结论已验证」三总状态独立展示，不互相冒充。
- **不执行被分析项目的脚本**；出站 LLM 请求必须先过出站过滤器。
- **SQLite 不做跨进程写协调者**：短事务（<100ms）+ `busy_timeout=5000` + BUSY 指数退避。

---

## 目录结构

```
src/app/            Next.js 页面与 API 路由（6 个 API、3 个页面）
src/lib/
  ingest.ts         路径 / zip 导入与安全校验
  scan.ts           技术栈识别、端点与路由抽取
  symbols.ts        ts-morph 符号抽取
  tasks.ts          任务状态机、幂等键、心跳、恢复
  settings.ts       设置读写（密钥只写不读、掩码返回）
  db/               连接、迁移、0001_init.sql（19 张表）
  llm/              client.ts（缓存/重试/zod）、outbound.ts（出站过滤）、ssrf.ts
worker/worker.ts    分析 worker（当前仅 scan 阶段）
scripts/            regression.ts + verify/（T1–T6 与 C 组闭环）
fixtures/           fixture1-todo-clip + fixture1-expected.json
aidd-wiki/          AIDD 方法论文档体系（需求 / 设计 / 标准 / 计划）
data/               运行时数据（git 忽略）：app.db、备份、workspaces
```

---

## 文档

- 项目定位与范围：`aidd-wiki/overview.md`
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
| **P0**（当前） | 技术验证 T1–T6、最小闭环 C1–C5、脚手架、导入、Scan 预览、fixture#1、回归雏形 |
| P1 | 一条真实业务流端到端追踪 + 证据卡 + 术语 chip + 一道自测题 + 一个定位挑战 |
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
