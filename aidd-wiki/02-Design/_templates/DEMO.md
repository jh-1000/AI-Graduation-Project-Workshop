---
project: <slug>
type: design-demo
module: <module>
area: <area>
point: <point>
title: DEMO
parent: "[[01-Requirements/modules/<module>/<area>/<point>/<point>]]"
phase: design
status: draft
date: YYYY-MM-DD
---

# DEMO — <point>

> 从 `_templates/DEMO.md` 复制；对齐 [[02-Design/standards/demo]]。

## 路由

| 路由 | 页面 | 入口 |
|------|------|------|
| /example | 示例页 | 侧栏菜单 |

## fe-demo 对照（入库时须已存在对应 tsx）

| 文件 |
|------|
| `output/fe-demo/src/app/(app)/example/page.tsx` |

## 线框

```text
+----------------------------------+
| 标题                    [操作]    |
| 筛选区                            |
| 主内容区（表/表单）                |
+----------------------------------+
```

## 组件树

- Page
  - FilterBar
  - DataTable / FormModal

## 字段与校验

| 字段 | 组件 | 校验 | F-ID |
|------|------|------|------|
| | | | F-001 |

## 状态

| 状态 | UI |
|------|-----|
| loading | 骨架屏 / Spin |
| empty | 空态文案 + 引导操作 |
| error | 错误提示 + 重试 |
| forbidden | 无权限说明 |

## 交互流程

1. 用户 … → 调用 API-001
2. 成功 → toast + 刷新列表
3. 失败 → 展示错误码文案

## API 对齐

| 步骤 | API-ID | 说明 |
|------|--------|------|
| 1 | API-001 | |

## 关联

- [[01-Requirements/modules/<module>/<area>/<point>/SPEC|SPEC]]
- [[../../DES-<module>]]
- [[../../api/API]]
- [[02-Design/standards/demo]]
- [[../../../output/fe-demo/README|fe-demo]]（若已导入）
