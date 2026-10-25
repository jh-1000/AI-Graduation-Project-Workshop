---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 分析引擎 `analysis`

## 架构要点
- 选料：`src/lib/repomap.ts`——web-tree-sitter 符号引用图 → 个性化 PageRank → token 预算二分拟合；只定优先级不定覆盖口径
- Map 流水线：worker 子进程内 10 阶段（架构→模块→流程→知识点→术语→建边→体检→git→双重校验→覆盖）；阶段事务落盘、断点续跑按 (stage, step) 恢复
- 双重校验：`src/lib/dual-check.ts` 四查（支持性/反例失败分支/范围/冲突），失败转 flagged 或 open_questions
- 体检：正则规则集（TODO/console.log/空 catch 等，12 smell baseline 补充）；git 考古：按功能聚合提交

## 数据与状态
- 写 nodes/edges/flows/flow_steps/terms/claims/evidence/open_questions/repo_insights/history_events
- 每条结论带 analysis_version 与证据引用

## 接口意图
- POST /api/projects/[id]/analyze（启动 Map）、GET /api/projects/[id]/progress

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[repo-map/SPEC\|SPEC]] | repomap.ts；覆盖统计与选料解耦 |
| [[map-pipeline/SPEC\|SPEC]] | worker 10 阶段编排；zod 校验+缓存；预算优先级收尾 |
| [[dual-check/SPEC\|SPEC]] | dual-check.ts；fact_conflicts 记录 |
| [[audit/SPEC\|SPEC]] | audit 规则集；git log 聚合（无 git 降级） |

## 关联
- [[02-Design/Design-Graph]]
