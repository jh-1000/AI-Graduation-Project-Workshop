---
project: proj-analysis-learner
type: requirement
parent: "[[map-pipeline]]"
status: active
---
# REQ — Map 分阶段流水线

## 用户故事
- US-1: 作为用户，我想看到项目的架构总览、模块划分、端到端业务流程与知识点，并确信每条结论都有证据。
- US-2: 作为用户，我想在分析中断或预算耗尽后能从明确位置恢复，已完成部分立即可学。

## 验收标准
- AC-1: fixture#1 的已知业务流程被完整还原（模板各步骤有对应 flow_step 与证据）。
- AC-2: 每条结论附带 file:line 证据与来源标注。
- AC-3: 单阶段失败不重跑全部；预算耗尽按关键入口→核心模型→重要流程收尾。
