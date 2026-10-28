---
project: proj-analysis-learner
type: design-ui
module: analysis
area: p1-loop
point: UI
title: UI — P1 最小闭环（项目分析页）
fe_demo_route: /project/[id]
fe_demo_file: src/app/project/[id]/page.tsx
ui_code: src/app/project/[id]/page.tsx
phase: design
status: active
date: 2026-10-27
---

# UI — P1 最小闭环（项目分析页）

> UI 设计（Wiki）。可运行代码在 `fe_demo_file`；勿在 `output/fe-demo` 内再建 Obsidian 笔记。

## 与 `standards/ui.md` 默认约定的偏差（已知并接受）

| 默认约定 | 本项目实际 | 理由 |
| --- | --- | --- |
| `fe_demo_file` 指向 `output/fe-demo/src/app/...` | 指向 `src/app/project/[id]/page.tsx` | 本项目真实交付物是 Next.js 应用，`output/fe-demo/index.html` 是自包含设计原型，不是可运行前端。项目 Artifact 优先于 Skill 模板默认。 |
| 列表页强制 `P-LIST-FILTER` + `ListPagination`（`standards/ui.md:56`） | 本页是**详情页**，非列表页，无分页控件 | 证据卡与符号 chip 用 `slice(0,20)` / `slice(0,40)` 截断展示，截断属已知缺口（见「已知缺口」）。 |
| 筛选区一行 `flex flex-wrap items-end gap-3` | 无筛选区 | 详情页无检索需求，筛选归项目列表页。 |

## 路由

| 路由 | 说明 |
|------|------|
| `/project/[id]` | 单项目分析页：技术栈 / 文件解析 / 任务 / 证据卡 / 结论层 / 业务流程 / 知识节点 / 术语 / 自测题 / 定位挑战 / 端点 / 路由 / 文件表 |

## 数据来源（只读端点）

| 区块 | 端点 | 版本口径 |
|------|------|----------|
| 技术栈 / 文件解析 / 端点 / 路由 / 文件表 | `GET /api/projects/[id]/preview` | 现读磁盘 |
| 任务表 | `GET /api/projects/[id]`（`runs`，最近 10 条） | — |
| 证据卡 | `GET /api/projects/[id]/evidence`（`?version=` 可覆盖） | 缺省取 `evidence` 最新 `analysis_version`；`symbols` 同版本过滤 |
| 结论层 | `GET /api/projects/[id]/claims`（`?version=` 可覆盖） | 缺省取 `claims` 最新 `analysis_version`；`claim_evidence` 按 `claim_id` 分组内联为 `supports` |
| 业务流程 | `GET /api/projects/[id]/flows` | 最新 `flows` 版本，`flow_steps` 按 `flow_id` 分组 |
| 知识节点 | `GET /api/projects/[id]/nodes` | 最新 `nodes` 版本，`sections` 从 JSON 解析 |
| 术语卡片 | `GET /api/projects/[id]/terms` | **不按版本过滤**（`terms` 以 `(project_id, slug)` 唯一，跨版本 upsert） |
| 自测题 / 定位挑战 | `GET /api/projects/[id]/practice` | 最新 `practice_items` 版本，`hints` 从 JSON 解析 |

页面加载：先串行取 `preview` 与项目详情（`preview` 非 2xx 即置 `fatal` 并 return），再用一次 `Promise.all` 并发取后 6 个端点（`page.tsx:158-177`）。

## 组件树

```text
ProjectPage（page.tsx:118）
├─ 页头：返回链接 + 「项目分析」+ 琥珀徽标「初步清单 · 不代表完整分析」（:224-232）
├─ 三栏（md:grid-cols-3，:234-280）
│   ├─ 技术栈（languages + frameworks chip）
│   ├─ 文件解析情况（parse_mode 计数）
│   └─ 后台分析任务：「启动扫描任务（scan）」+「启动完整分析（map）」+ 说明文案 + error
├─ 任务表（:281-325）：版本 / 类型 / 状态 / 阶段·步骤 / 恢复次数 / 更新时间；activeRun 1 秒轮询
├─ 证据卡（:326-368）：版本徽标 + 证据行（file:line + note + origin/processing/freshness 三徽标）+ 符号 chip
├─ 结论层（:369-409）：版本副标题（N 条 supported · M 条 draft）+ 结论行（review_state 徽标 + derivation 徽标 + 主体引用 + 内容 + 支撑证据 chip）
├─ 业务流程（:411-445）：标题 + status 徽标 + 触发描述 + <ol> 序号圆点 + file:line
├─ 知识节点（:447-477）：title + kind + status + summary + sections + 「依据：evidence_note」
├─ 术语卡片（:479-505）：<details> 折叠，通俗 / 专业 / 示例 / 误区 / 别名
├─ 自测题 + 定位挑战（lg:grid-cols-2，:507-559）：revealed 控制「查看答案」/「揭示位置」
├─ API 端点 + 前端路由（:561-601）：各取前 30
└─ 文件表（:603-629）：前 100 / 共 N
```

## 状态与交互

| 状态 | 表现 |
|------|------|
| 页面首屏未取到 `preview` | 显示「加载中…」（`page.tsx:215`） |
| 启动任务 | `startAnalyze(kind)` POST `{ kind }` 到 `/api/projects/[id]/analyze`；成功即 `setActiveRun(runId)`，失败显示红字 `error` |
| 任务进行中 | 1 秒轮询 `/api/runs/[id]`；`completed` / `failed` 时 `clearInterval` 并整体 `load()` 刷新全部区块 |
| 证据为空 | 标题右侧灰字「尚无证据：先启动一次扫描任务」 |
| 结论为空 | 标题右侧灰字「尚无结论：启动一次分析任务后由证据与流程确定性推导」 |
| 业务流程为空 | 「尚无业务流程：启动一次「完整分析（map）」后生成（确定性追踪，不需要模型密钥）」 |
| 知识节点为空 | 「尚无节点讲解：该部分由模型生成，需先在设置页填写 API Key 后重跑完整分析」 |
| 术语为空 | 「尚无术语：需模型生成，配置密钥后重跑完整分析」 |
| 自测题 / 定位挑战为空 | 「尚无自测题：需模型生成」/「尚无定位挑战：需模型生成」 |
| 答案揭示 | 每题独立 `revealed[id]` 开关，按钮文案在「查看答案 ↔ 收起答案」「揭示位置 ↔ 收起位置」间切换 |

**空态文案规则**：每个区块为空时必须说明「为什么空」（未启动 / 需密钥），不得用空列表或 0 计数冒充「已完成」。

## 徽标语义

| 徽标 | 取值 | 色调 |
|------|------|------|
| 证据 `origin` | `source_code` / `static_analyzer` / `llm` / `user` / `runtime` / `unknown` | 中性灰（来源不是置信度） |
| 证据 `processing` | `extracted` / `linked` / `reviewed` | 中性灰 |
| 证据 `freshness` | `current` → 绿；`shifted` / `stale` → 琥珀 |
| 节点/流程/练习 `status` | `confirmed` → 绿；`pending_review` → 琥珀；其余 → 灰（`statusTone`，`page.tsx:134`） |
| 结论 `review_state` | `supported` → 绿；`draft` → 琥珀（draft = 结论未被证据完整支撑，不是失败） |
| 结论 `derivation` | `inferred` / `direct_extraction` → 中性灰（推导强度不是置信度） |
| 页头「初步清单 · 不代表完整分析」 | 常驻琥珀 | 三总状态不互相冒充 |

## API 对齐

| 步骤 | 端点 | 操作类型 |
|------|------|----------|
| 加载页面 | `GET /api/projects/[id]/preview` | read |
| 加载任务表 | `GET /api/projects/[id]` | read |
| 加载证据卡 | `GET /api/projects/[id]/evidence` | read |
| 加载业务流程 | `GET /api/projects/[id]/flows` | read |
| 加载知识节点 | `GET /api/projects/[id]/nodes` | read |
| 加载术语 | `GET /api/projects/[id]/terms` | read |
| 加载练习 | `GET /api/projects/[id]/practice` | read |
| 加载结论层 | `GET /api/projects/[id]/claims` | read |
| 启动分析 | `POST /api/projects/[id]/analyze`（body `{ kind, idemKey? }`） | create |
| 轮询任务 | `GET /api/runs/[id]` | read |

## 代码关联

| 项 | 路径 |
|----|------|
| 页面 | `src/app/project/[id]/page.tsx` |
| 只读端点 | `src/app/api/projects/[id]/{evidence,claims,flows,nodes,terms,practice}/route.ts` |
| 启动端点 | `src/app/api/projects/[id]/analyze/route.ts` |
| 注释 | `page.tsx:2` `/** @aidd-ui 02-Design/modules/analysis/ui/p1-loop/UI.md */` |

## 已知缺口

- 证据卡只显示前 20 条证据、前 40 个符号；文件表只显示前 100 行——都是 `slice` 截断，无分页控件。数据量大的项目会看不全。
- 结论层只显示前 20 条结论（`slice(0, 20)`）；`review_state` 只读，页面上没有人工复核入口（P3）。
- 实机走查只覆盖 fixture1 单项目（`/project/35`，map 跑完五个区块正常渲染）；大仓库、窄屏、以及各只读端点的失败态尚未系统验证。
- 错误态已修一处：访问不存在的项目时，`load()` 原先不检查 `res.ok`，把 `{ error }` 当数据用导致整页 `Application error`；现 preview 非 2xx 置 `fatal` 渲染提示，其余 5 个端点非 2xx 回退空对象。
- 未接入 `output/fe-demo/.aidd-pages.json`（机器可读索引），因为本项目前端不在 `output/fe-demo` 内；当前 UI ↔ 代码双向追溯只靠 frontmatter 的 `fe_demo_file` 与源码第 2 行的 `@aidd-ui` 注释。

## 关联

- 需求：[[01-Requirements/modules/analysis/map-pipeline/map-pipeline|map-pipeline]] · [[01-Requirements/modules/learning/practice/practice|practice]] · [[01-Requirements/modules/learning/terms/terms|terms]] · [[01-Requirements/modules/evidence/model/model|evidence/model]]
- 设计：[[02-Design/modules/analysis/DES-analysis|DES-analysis]] · [[02-Design/modules/evidence/DES-evidence|DES-evidence]]
- 开发记录：[[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]] · [[04-Dev-Tasks/BE-claims|BE-claims]]
- 规范：[[02-Design/standards/ui|ui]]