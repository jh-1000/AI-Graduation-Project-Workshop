---
project: proj-analysis-learner
type: design-standards
standard: ui
phase: design
status: active
date: 2026-10-25
---

# Standard — UI 设计

## 命名

| 旧称 | 现称 |
|------|------|
| Demo 设计 | **UI 设计** |
| `demo/.../DEMO.md` | `ui/.../UI.md` |
| `范围:demo` | `范围:ui`（`demo` 可作别名） |

## 闭环（强制）

`范围:ui` 入库 = **两步同一轮完成**，不得只做文档：

```text
1. UI 设计 → 写 Wiki：modules/<m>/ui/<area>/<point>/UI.md（可用 Obsidian 双链）
2. Demo 实现 → 写代码：output/fe-demo/src/...（自动随 UI 入库执行）
```

| 方向 | 机制 |
|------|------|
| UI → 代码 | UI.md 的 `fe_demo_file`、`fe_demo_route`（frontmatter，纯文本路径） |
| 代码 → UI | 源文件首行块注释 `/** @aidd-ui <相对 aidd-wiki 的 UI.md 路径> */` |
| 机器可读 | `output/fe-demo/.aidd-pages.json`：`uiWiki` + `file` + `route`（JSON，非 Obsidian） |

## output/fe-demo 内 Markdown 约束

| 允许 | 禁止 |
|------|------|
| 根目录 `README.md`（安装/启动说明，**无** `[[wikilink]]`） | 在 fe-demo 内复制 `UI.md` |
| `.aidd-meta.json`、`.aidd-pages.json` | frontmatter 知识库字段、Obsidian 标签/双链 |
| `src/**` 源码 | 每个页面旁再建一份设计说明 `.md` |

设计说明**只**存在于 `02-Design/modules/.../ui/.../UI.md`。

## UI.md 必填

| 字段/节 | 说明 |
|---------|------|
| `fe_demo_file` | 如 `output/fe-demo/src/app/(app)/models/page.tsx` |
| `fe_demo_route` | 如 `/models` |
| 路由 / 组件树 / 状态 / 交互 / API / **分页** | 列表页必填分页节 |
| `ui_code` | 与 `fe_demo_file` 相同（便于人读） |

## 列表页分页（强制）

P-LIST-FILTER：`Table` + **`ListPagination`**（Tailwind UI 底栏：`border-t`、左侧「显示第 X 至 Y 条，共 Z 条」、右侧 `ChevronLeft/Right` + 页码、当前页 `bg-indigo-600`）；`@heroicons/react/20/solid`。fe-demo：`components/list-pagination.tsx`。对接 API **page**，请求始终带 `pageNo`、`pageSize`、`rainbow`。

## 页面模式（Catalyst）

| 模式 | 说明 |
|------|------|
| P-LIST-FILTER | 筛选一行 + `Table` + **Pagination** |
| P-DIALOG-FORM | 列表同页 `Dialog` 表单 |

## Dialog 表单必填标识（强制）

`P-DIALOG-FORM`（新建 / 编辑 `Dialog`）中，**业务必填**字段的标签须标红色星号：

| 项 | 约定 |
|----|------|
| 组件 | `RequiredLabel`（`output/fe-demo/src/components/fieldset.tsx`） |
| 样式 | 标签文案 + `<span class="text-red-600 dark:text-red-400">*</span>`，`aria-hidden="true"` |
| 非必填 | 使用普通 `Label`，**不加** `*` |
| 说明文案 | 选填提示用 `Description` 放在控件上方或下方，不写入 `Label` |
| UI.md | 表单字段表须标注「必填」列；Demo 与 Wiki 一致 |

## 筛选区布局（强制）

≥2 个筛选条件时：**同一行** `flex flex-wrap items-end gap-3`；搜索 `flex-1 max-w-md` + 各 `Select` 外包 `w-36 shrink-0` 且 `Select className="w-full"`。禁止 `Select` 不包宽度直接作 flex 子项（会整行撑满）。

UI.md 须写清「筛选区（一行）：搜索 + 下拉 …」。

索引：[[README]]。
