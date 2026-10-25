---
project: proj-analysis-learner
type: design-ui
module: <module>
area: <area>
point: <point>
title: UI
fe_demo_route: /todo
fe_demo_file: output/fe-demo/src/app/(app)/todo/page.tsx
phase: design
status: draft
date: 2026-10-25
---

# UI — <point>

> UI 设计（Wiki）。可运行代码在 `fe_demo_file`；勿在 output/fe-demo 内再建 Obsidian 笔记。

## 路由

| 路由 | 说明 |
|------|------|
| /todo | |

## 筛选区（列表页，≥2 条件时一行排列）

| 控件 | Catalyst | 布局 |
|------|----------|------|
| 关键词 | `InputGroup` + `Input` | `flex-1 max-w-md` |
| 其它 | `Select` | 各 `w-36 shrink-0` 包裹 |

容器：`flex flex-wrap items-end gap-3`（见 `standards/ui.md` § 筛选区布局）。

## 分页（列表页必填）

| 项 | 说明 |
|----|------|
| 默认 | `pageNo=1`，`pageSize=20` |
| 组件 | `Table` 下方 `Pagination*` |
| API | `API-xxx`（操作类型 **page**），请求含 `pageNo`、`pageSize` |

## 组件树

（含 `Table`、`Pagination` 等 Catalyst 组件。）

## 状态与交互

（含翻页、筛选重置页码。）

## API 对齐

| 步骤 | API-ID | 操作类型 |
|------|--------|----------|
| 加载/筛选/翻页 | API-001 | page |

## 代码关联

| 项 | 路径 |
|----|------|
| fe-demo | `output/fe-demo/src/app/(app)/todo/page.tsx` |
| 注释 | 源码顶部 `@aidd-ui 02-Design/modules/<module>/ui/<area>/<point>/UI.md` |

## 关联

- SPEC：`01-Requirements/modules/<module>/<area>/<point>/SPEC.md`
- 规范：`02-Design/standards/ui.md`
