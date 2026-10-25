---
project: proj-analysis-learner
type: requirement
parent: "[[invalidation]]"
status: active
---
# REQ — 失效传播

## 用户故事
- US-1: 作为用户，源码变化后我要求系统不把旧结论当当前事实，并明确哪些内容需重新核查。

## 验收标准
- AC-1: 修改文件后，直接证据/结论 stale 并沿依赖多跳传播到 flows/答辩题/挑战基线。
- AC-2: 无法判断影响的文件→保守失
