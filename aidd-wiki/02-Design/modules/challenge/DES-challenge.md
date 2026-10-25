---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 实战挑战 `challenge`

## 架构要点
- 隔离区：git 项目用 `git worktree add`；非 git 用副本工作区 + 原文件备份表；基线固定（含未提交修改提示）
- 挑战类型：locate（点选校验，引用图+行号容差）/ modify（diff+验证命令）/ mutation（破坏实验一键还原）
- 验证闭环六查 + 结果三态（代码已修改/验证已执行/验收条件满足）；命令独立副作用审查 + 超时/终止/输出上限
- 过关判定=完成审计（逐验收条件找权威证据）

## 数据与状态
- challenges/challenge_runs（run_type/基线版本/diff/验证命令/结果/回滚信息）

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[drill/SPEC\|SPEC]] | challenge.ts 引擎 + worktree 管理 + 验证运行器 |

## 关联
- [[02-Design/Design-Graph]]
