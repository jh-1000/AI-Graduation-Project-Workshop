---
project: proj-analysis-learner
type: spec
parent: "[[map-pipeline]]"
status: active
is_latest: true
---
# SPEC — Map 分阶段流水线

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 架构总览 | 技术栈判定、分层描述、模块划分 |
| F-2 | 模块深挖 | 模块职责、核心机制、功能清单 |
| F-3 | 流程还原 | 按可配置模板还原端到端链（含分支失败路径） |
| F-4 | 知识点生成 | 10 段结构 + 证据引用 + 置信 + 前置术语清单 |
| F-5 | 术语归并 | 前置概念去重进术语中心 |
| F-6 | 建边 | CONTAINS/IMPORTS/CALLS/IMPLEMENTS/RELATES_TO/EXPLAINS，边标来源 |
| F-7 | 预算控制 | 时间/令牌/并发/重试/输出上限；耗尽按优先级收尾 |

## 业务规则
- R-1: LLM 输出经 zod 校验，失败重试后仍失败转"待复核"。
- R-2: 每阶段产物即时落盘，断点续跑按阶段+步骤位置恢复。
- R-3: 质量指标为结论准确性/关键路径覆盖/证据支持/学习完成效果，不用节点数量。

## 验收标准
- AC-1: 同 fixture 重跑结果经缓存后成本显著下降且结论一致。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/analysis/DES-analysis\|DES]] |
