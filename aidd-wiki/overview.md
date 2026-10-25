---
project: proj-analysis-learner
type: overview
phase: requirements
status: active
date: 2026-10-25
---

# 软件项目分析学习系统

**一句话定位**：AI 辅助开发者的项目理解与能力训练系统——帮"能借 AI 做出项目、却说不清它怎么运行"的用户，从"AI 帮我做出来了"走到"我知道它为什么这样实现、我能判断它是否正确、我有能力继续维护它"。

## Goals

- 导入一个 AI 辅助开发的软件项目，拆解为**可交互知识图谱**与**端到端业务流程线**，每条结论可回溯到源码证据
- 提供**学习闭环**：知识点讲解（含寓言卡）、主动回忆练习、FSRS 间隔复习、能力雷达
- 提供**答辩演练**：模拟评委一次一问、双轴评分、薄弱点报告
- 提供**实战挑战**：定位 / 隔离改码 / 破坏实验，全部有验证有回滚
- 成功标准：用户不看答案能独立解释业务流程并定位代码；影响面答案与已知引用一致；破坏实验 100% 可还原

## Scope

- In scope：本地项目导入（路径/zip）→ Scan 静态证据 → Map（LLM 分阶段拆解）→ Explore（学习/答辩/挑战）；证据生命周期与失效传播；六维覆盖报告；fixture 回归评测；安全授权与任务恢复
- Out of scope：多用户/登录、云部署、实时协作、IDE 插件、移动端、AI 理论课程、二进制逆向、向量库全库 RAG、CI 服务、消息队列/工作流引擎/独立治理平台

## Stakeholders

| Role | Description |
|------|-------------|
| 用户（AI 辅助开发者） | 借 AI 完成项目、需在答辩前吃透项目的人；也是本系统唯一操作者 |
| 答辩评委（模拟对象） | 会追问功能实现原理、机制位置、设计理由与失败边界 |
| 系统自身 | 需遵守可信度原则：证据优先，AI 不产生事实 |
| LLM 服务 | OpenAI 兼容 API（GLM/DeepSeek/Ollama 均可），仅组织解释不产生事实 |

## Tech stack

Next.js 15 (App Router) + TypeScript + Tailwind 全栈单体；better-sqlite3（WAL，`serverExternalPackages`）；ts-morph（TS/JS 深度语义）+ web-tree-sitter（多语言符号）+ 个性化 PageRank（选料）；ts-fsrs（复习调度）；Cytoscape.js（图谱）；Shiki（代码高亮）；openai 包（OpenAI 兼容 API）；独立 worker 子进程。

## 设计约束

- 全局遵守 [[02-Design/standards/README]] 设计规范；需求↔设计双链规范见 [[02-Design/standards/trace]]
- 可信度三状态（任务完成/覆盖充分/结论已验证）与七条不等式贯穿 UI
- 分层授权 Auth-L0~L6、任务状态机六状态、SQLite 并发短事务纪律（详见设计文档）
- **最终目标：便携模式**——全部状态仅存应用目录相对 `data/`，随目录拷贝即可迁移（不变量见 [[../_slots/project-invariants]]）

## Links

- [[index]]
- [[02-Design/Design-Graph]]
