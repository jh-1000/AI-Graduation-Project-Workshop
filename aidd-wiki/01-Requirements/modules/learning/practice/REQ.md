---
project: proj-analysis-learner
type: requirement
parent: "[[practice]]"
status: active
---
# REQ — 练习与掌握度

## 用户故事
- US-1: 作为用户，我要求系统区分"看过/借助提示完成/独立完成/经运行验证"。
- US-2: 作为用户，答错时不希望直接看到答案，而是先得到提示。

## 验收标准
- AC-1: 六级练习+阶梯提示可用；同一题重复答对不虚增掌握。
- AC-2: 能力雷达六维，每维记录判断依据；三态判定正确。
- AC-3: FSRS 只管复习调度，掌握判定靠独立证据。
