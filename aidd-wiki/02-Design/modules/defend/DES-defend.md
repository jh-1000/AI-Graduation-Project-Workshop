---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 答辩模拟 `defend`

## 架构要点
- 会话引擎：grill_sessions/turns；一次一问状态机；追问基于回答缺口解析
- 评委 prompt：注入任务书 + 知识点上下文 + 代码证据片段；出题源=知识点/体检追问点（疑似标注）/AI 题型库
- 双轴评分：轴 A 代码事实自洽 / 轴 B 兑现声称——两个独立子代理评、并排呈现、不合并
- 薄弱点报告：聚合错题与低分轴 → 链回知识点与代码证据

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[grill/SPEC\|SPEC]] | defend.ts 会话状态机 + 双轴评分器 + 报告聚合 |

## 关联
- [[02-Design/Design-Graph]]
