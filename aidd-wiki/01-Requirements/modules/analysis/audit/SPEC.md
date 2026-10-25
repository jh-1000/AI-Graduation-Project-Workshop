---
project: proj-analysis-learner
type: spec
parent: "[[audit]]"
status: active
is_latest: true
---
# SPEC — 全库体检与 git 考古

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 代码体检 | TODO/FIXME、console.log 残留、注释代码、重复、命名不一致、空 catch、未处理分支 |
| F-2 | 追问点清单 | 输出"最可能被追问的点"，供答辩题源 |
| F-3 | git 演进时间线 | 按功能聚合提交历史（意图/改动/AI 迭代痕迹） |

## 业务规则
- R-1: 体检是 judgement call 不是硬违规，须标注疑似。
- R-2: git 不可用时功能降级为不可用，不阻塞其他分析。

## 验收标准
- AC-1: fixture#1 中预埋的 TODO 与空 catch 被检出且标"疑似"。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/analysis/DES-analysis\|DES]] |
