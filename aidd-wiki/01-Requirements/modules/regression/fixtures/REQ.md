---
project: proj-analysis-learner
type: requirement
parent: "[[fixtures]]"
status: active
---
# REQ — fixture 与回归

## 用户故事
- US-1: 作为用户，我要求系统质量用已知答案验证，任何解析器/提示词/模型变更都有回归兜底。

## 验收标准
- AC-1: 三个 fixture（简单/前后端/循环依赖）含预期结果清单。
- AC-2: 回归 10 项检查在每次引擎变更后执行。
- AC-3: 失败按九分类记录，不统一标"AI 分析失败"。
