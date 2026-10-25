---
project: proj-analysis-learner
type: design-standards
standard: ddl
phase: design
status: active
date: 2026-10-25
---

# Standard — DDL

| 项 | 约定 |
|----|------|
| 方言 | MySQL 8.x InnoDB；`utf8mb4` / `utf8mb4_0900_ai_ci` |
| 表名 | `t_<实体_snake>` |
| 主键 | `` `id` bigint NOT NULL ``，COMMENT `主键ID` |
| 外键列 | `` `<ref>_id` bigint `` |
| 排序号 | `` `sort_no` int NOT NULL DEFAULT '0' ``（见下节） |
| 审计+软删 | `create_time`、`create_user`、`update_time`、`update_user`、`deleted`（`tinyint` 0/1） |
| 注释 | 每列 + 表尾 COMMENT |
| 追溯 | `-- ENT-xxx / F-xxx` |

## 排序号 `sort_no`

**适用范围**：分页列表维护的主数据表（CRUD 列表页对应的持久化表）。日志、关联、纯字典无展示序需求时可省略。

| 项 | 约定 |
|----|------|
| 列名 | `sort_no` |
| 类型 | `int NOT NULL DEFAULT '0'` |
| 注释 | `排序号，越小越靠前` |
| 位置 | 业务字段之后、`create_time` 之前 |
| 索引 | `KEY idx_<表名不含t_>_sort_no (sort_no)` |
| 领域/API | 属性名 `sortNo`；create/update 可传，缺省 `0` |
| 列表默认序 | `page-query` 未传 `sortField` 时按 `sortNo` 升序 |

**与接口参数区分**：`sort_no` / `sortNo` 为行内展示顺序；`page-query` 的 `sortOrder` 仅表示 `asc` / `desc`，二者不得混用。

**示例**（节选）：

```sql
  `sort_no` int NOT NULL DEFAULT '0' COMMENT '排序号，越小越靠前',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  -- ...
  KEY `idx_base_sort_no` (`sort_no`) USING BTREE
```

索引：[[README]]。
