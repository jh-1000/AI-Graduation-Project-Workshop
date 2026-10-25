---
project: proj-analysis-learner
type: requirement
parent: "[[snapshot]]"
status: active
---
# REQ — 输入快照

## 用户故事
- US-1: 作为用户，我要求所有分析结论来自同一个已核对的项目版本，避免"改了一半"的结论混入。

## 验收标准
- AC-1: Scan 完成后生成 run_files 快照（路径+SHA-256）。
- AC-2: Map 每阶段读取前核对哈希，不匹配文件跳过并记开放问题。
- AC-3: 不匹配比例 >5% 或命中关键路径时整个 run 转 stale 并提示重跑。
