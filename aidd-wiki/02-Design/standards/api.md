---
project: proj-analysis-learner
type: design-standards
standard: api
phase: design
status: active
date: 2026-10-25
---

# Standard — API

| 项 | 约定 |
|----|------|
| 信封 | `code`、`success`、`message`、`data` |
| page | POST `/{resource}/page-query`；**表格列表必填** `pageNo`/`pageSize` |
| list | 仅下拉/选项；**禁止**顶替表格列表 |
| detail | GET `/{resource}/{id}` → `data` 单对象 |
| create | POST `/{resource}` |
| update | PUT/PATCH `/{resource}/{id}` |
| delete | DELETE `/{resource}/{id}` |

完整规范与示例见项目 `02-Design/standards/api.md`。

索引：[[README]]。
