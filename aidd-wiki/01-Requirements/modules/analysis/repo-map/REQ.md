---
project: proj-analysis-learner
type: requirement
parent: "[[repo-map]]"
status: active
---
# REQ — 上下文选料 PageRank

## 用户故事
- US-1: 作为用户，我希望大仓库分析只花必要的 token，且最关键的文件优先被分析。

## 验收标准
- AC-1: fixture#1 中核心业务文件被选入 LLM 上下文。
- AC-2: 选料结果不影响覆盖统计口径——未选中文件如实计入未覆盖。
