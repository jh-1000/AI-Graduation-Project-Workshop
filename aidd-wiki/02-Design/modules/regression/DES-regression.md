---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 回归评测 `regression`

## 架构要点
- fixtures/ 目录三个已知答案项目（简单 TS / 前后端分离 / 循环依赖+复杂状态），各带 expected.json（文件/符号/引用/流程/证据位置/开放问题/不应断言内容）
- 回归 runner：`scripts/regression.ts` 对 fixture 跑 Scan+选料+（可选）Map，比对 regression_specs；10 项检查；失败九分类输出
- 触发：解析器/提示词/数据模型/核心流程任何变更后必须执行

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[fixtures/SPEC\|SPEC]] | fixture 目录结构 + regression.ts runner + 失败分类器 |

## 关联
- [[02-Design/Design-Graph]]
