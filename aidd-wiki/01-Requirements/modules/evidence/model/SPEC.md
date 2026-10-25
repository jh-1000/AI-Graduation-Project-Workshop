---
project: proj-analysis-learner
type: spec
parent: "[[model]]"
status: active
is_latest: true
---
# SPEC — 统一证据模型

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 三维度拆分 | origin（来源）/ derivation（推导方式）/ review_state（核查状态）独立字段 |
| F-2 | 证据两维 | processing（extracted→linked→reviewed）与 freshness（current/shifted/stale） |
| F-3 | 结论状态机 | draft→supported→reviewed；可转 flagged/superseded |
| F-4 | 运行验证类型 | 8 类标签（static_lint…manual_review），记断言范围与未覆盖场景 |
| F-5 | 证据层 E1-E4 | 描述依据深度，与授权层 Auth-L0~L6 互不混淆 |

## 业务规则
- R-1: 七条不等式贯穿 UI 文案（文件存在≠结论正确等）。
- R-2: 三总状态独立展示：任务完成/覆盖充分/结论已验证。
- R-3: 可信度七原则生效（Correction 三段式、通用知识标版本等）。

## 验收标准
- AC-1: 构造带部分证据的结论，UI 正确区分 supported 与 verified。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/evidence/DES-evidence\|DES]] |
