---
project: proj-analysis-learner
type: design-standards
standard: domain
phase: design
status: active
date: 2026-10-25
---

# Standard — 领域建模

- 以**聚合**为边界；实体 / 值对象 / 领域事件分开写。
- 状态名与 SPEC **业务状态**一致；转换在 ENT 展开。
- 不在 ENT 写 SQL；表结构只在 `ddl/schema.sql`。

索引：[[README]]。
