---
project: proj-analysis-learner
type: requirement
parent: "[[audit]]"
status: active
---
# REQ — 全库体检与 git 考古

## 用户故事
- US-1: 作为用户，我想提前知道评委最可能追问的代码瑕疵。
- US-2: 作为用户，我想看到功能随提交历史演进的时间线，用于回答"你怎么用 AI 做出来的"。

## 验收标准
- AC-1: 体检发现均标"疑似"，不当确定缺陷出题。
- AC-2: 非 git 项目自动降级不阻塞。
