---
project: proj-analysis-learner
type: requirements-graph
phase: requirements
status: active
date: 2026-10-25
---

# Requirements Graph

> 每层一个节点，**只链直接父级**；§ **与 Design** 维护需求↔设计 Obsidian 双链（规范见 `02-Design/standards/trace.md`）。

## 图谱主干

```text
<module> → <point> → REQ/SPEC
```

## 模块树

| 级别 | 节点 | 说明 | 状态 | 链接 |
|------|------|------|------|------|
| L1 | ingestion | 导入与扫描：路径/zip 导入、静态扫描、输入快照 | active | [[ingestion]] |
| L3 | import | 项目导入 | active | [[import/REQ\|REQ]] · [[import/SPEC\|SPEC]] |
| L3 | scan | 静态扫描 Scan | active | [[scan/REQ\|REQ]] · [[scan/SPEC\|SPEC]] |
| L3 | snapshot | 输入快照 | active | [[snapshot/REQ\|REQ]] · [[snapshot/SPEC\|SPEC]] |
| L3 | code-view | 代码库阅读器 | active | [[code-view/REQ\|REQ]] · [[code-view/SPEC\|SPEC]] |
| L1 | analysis | 分析引擎：选料、Map 流水线、双重校验、体检考古 | active | [[analysis]] |
| L3 | repo-map | 上下文选料 PageRank | active | [[repo-map/REQ\|REQ]] · [[repo-map/SPEC\|SPEC]] |
| L3 | map-pipeline | Map 分阶段流水线 | active | [[map-pipeline/REQ\|REQ]] · [[map-pipeline/SPEC\|SPEC]] |
| L3 | dual-check | 双重校验 | active | [[dual-check/REQ\|REQ]] · [[dual-check/SPEC\|SPEC]] |
| L3 | audit | 全库体检与 git 考古 | active | [[audit/REQ\|REQ]] · [[audit/SPEC\|SPEC]] |
| L1 | evidence | 证据与可信度：统一模型、失效传播、覆盖报告 | active | [[evidence]] |
| L3 | model | 统一证据模型 | active | [[model/REQ\|REQ]] · [[model/SPEC\|SPEC]] |
| L3 | invalidation | 失效传播 | active | [[invalidation/REQ\|REQ]] · [[invalidation/SPEC\|SPEC]] |
| L3 | coverage | 覆盖报告 | active | [[coverage/REQ\|REQ]] · [[coverage/SPEC\|SPEC]] |
| L1 | learning | 学习闭环：导览、知识点页、术语补课、练习掌握、AI 协作 | active | [[learning]] |
| L3 | tour | 导览与入口 | active | [[tour/REQ\|REQ]] · [[tour/SPEC\|SPEC]] |
| L3 | node-page | 知识点页 | active | [[node-page/REQ\|REQ]] · [[node-page/SPEC\|SPEC]] |
| L3 | terms | 术语中心与前置补课 | active | [[terms/REQ\|REQ]] · [[terms/SPEC\|SPEC]] |
| L3 | practice | 练习与掌握度 | active | [[practice/REQ\|REQ]] · [[practice/SPEC\|SPEC]] |
| L3 | ai-collab | AI 协作实践与助手 | active | [[ai-collab/REQ\|REQ]] · [[ai-collab/SPEC\|SPEC]] |
| L3 | kb | 知识库体系 | active | [[kb/REQ\|REQ]] · [[kb/SPEC\|SPEC]] |
| L1 | defend | 答辩模拟 | active | [[defend]] |
| L3 | grill | 答辩演练 | active | [[grill/REQ\|REQ]] · [[grill/SPEC\|SPEC]] |
| L1 | challenge | 实战挑战 | active | [[challenge]] |
| L3 | drill | 定位与改码挑战 | active | [[drill/REQ\|REQ]] · [[drill/SPEC\|SPEC]] |
| L1 | platform | 平台底座：任务恢复、存储并发、安全授权 | active | [[platform]] |
| L3 | tasks | 任务与恢复 | active | [[tasks/REQ\|REQ]] · [[tasks/SPEC\|SPEC]] |
| L3 | storage | 存储与并发 | active | [[storage/REQ\|REQ]] · [[storage/SPEC\|SPEC]] |
| L3 | security | 安全授权 | active | [[security/REQ\|REQ]] · [[security/SPEC\|SPEC]] |
| L1 | regression | 回归评测 | active | [[regression]] |
| L3 | fixtures | fixture 与回归 | active | [[fixtures/REQ\|REQ]] · [[fixtures/SPEC\|SPEC]] |

## 与 Design（Obsidian 双链）

### L1 模块

| 需求 L1 | 设计 DES |
|---------|----------|
| [[ingestion]] | [[02-Design/modules/ingestion/DES-ingestion\|DES]] |
| [[analysis]] | [[02-Design/modules/analysis/DES-analysis\|DES]] |
| [[evidence]] | [[02-Design/modules/evidence/DES-evidence\|DES]] |
| [[learning]] | [[02-Design/modules/learning/DES-learning\|DES]] |
| [[defend]] | [[02-Design/modules/defend/DES-defend\|DES]] |
| [[challenge]] | [[02-Design/modules/challenge/DES-challenge\|DES]] |
| [[platform]] | [[02-Design/modules/platform/DES-platform\|DES]] |
| [[regression]] | [[02-Design/modules/regression/DES-regression\|DES]] |

### 设计总览

- [[02-Design/Design-Graph|Design Graph]]

## 关联

- [[overview]]
- [[index]]
