---
project: proj-analysis-learner
type: spec
parent: "[[coverage]]"
status: active
is_latest: true
---
# SPEC — 覆盖报告

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 六维统计 | 文件解析/符号识别/引用关系/业务流程识别/外部依赖/运行验证 |
| F-2 | 口径诚实 | PageRank 选料不影响覆盖口径 |
| F-3 | 版本对比 | 与上次分析的差异展示 |

## 业务规则
- R-1: 不以节点/边/题目数量为质量指标。

## 验收标准
- AC-1: fixture#1 覆盖报告与人工核验的预期一致。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/evidence/DES-evidence\|DES]] |
