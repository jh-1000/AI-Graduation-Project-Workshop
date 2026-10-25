---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 学习闭环 `learning`

## 架构要点
- **轻量混合检索**（tour.NL 路由与助手共用）：L1 结构化过滤（类型/技术域/掌握状态）→ L2 SQLite FTS5 中文词法 → L3 图谱双链邻域扩展（沿 edges 取关联条目，借鉴 aidd wiki-search）；P3 可选 L4：知识条目级语义索引（embedding 走免费源/Ollama，仅索引短文本条目）。源码全文 RAG 维持非目标——代码检索走整库符号/引用图
- 知识点页：十段 JSON 渲染 + 渐进披露（默认展开 1/3/4 段）；三档模式开关；Shiki 代码走读
- 寓言卡：四段固定（故事/反转/映射/回到项目），按提示词模板生成并缓存于节点 JSON
- 术语中心：terms + term_relations（前置/混淆）；GLOSSARY 纪律（理解后才收录/_Avoid 别名/版本标注）
- 练习：六级+阶梯提示；掌握判定与 ts-fsrs 调度分离；learning_attempts 记题型/难度/提示/看答案/重复/迁移
- 导览：目标入口卡 + NL 路由（不确定给候选）+ 五站；冲刺模式按日期排计划

## 数据与状态
- node_mastery（六维 + D/S/R + 证据强度 + 迁移）、learning_attempts、user_corrections

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[tour/SPEC\|SPEC]] | 入口卡组件 + 路由器 + 冲刺排程 |
| [[node-page/SPEC\|SPEC]] | 节点页渲染器 + 寓言卡组件 |
| [[terms/SPEC\|SPEC]] | terms 表 + 术语弹层 + 前置图 |
| [[practice/SPEC\|SPEC]] | 练习引擎 + ts-fsrs 封装 + 雷达组件 |
| [[ai-collab/SPEC\|SPEC]] | playbook JSON + 助手 API（证据绑定） |

## 关联
- [[02-Design/Design-Graph]]
