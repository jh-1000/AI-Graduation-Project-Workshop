---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 证据与可信度 `evidence`

## 架构要点
- 统一模型：claims（derivation/review_state/analysis_version）× evidence（origin/processing/freshness）多对多 + claim_dependencies（结论依赖结论）
- 失效传播：`src/lib/invalidation.ts`——变更文件重解析（tree-sitter/ts-morph AST 对比）→ 等价则行号重映射；有差异按节点定位；解析失败保守失效；多跳传播到 flows/nodes/答辩题/挑战基线
- 覆盖报告：coverage_stats 六维，与选料解耦；三总状态独立

## 数据与状态
- 状态字段见 [[model/SPEC|SPEC]]；版本绑定六类（工作区/最近分析/学习/答辩/挑战基线/挑战结束）

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[model/SPEC\|SPEC]] | 表结构字段与 UI 徽标规则 |
| [[invalidation/SPEC\|SPEC]] | invalidation.ts 传播引擎 |
| [[coverage/SPEC\|SPEC]] | coverage_stats 聚合查询 |

## 关联
- [[02-Design/Design-Graph]]
