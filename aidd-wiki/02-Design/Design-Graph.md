---
project: proj-analysis-learner
type: design-graph
phase: design
status: active
date: 2026-10-25
---

# Design Graph

> 由 `/aidd:design` 入库维护；与需求双链见 `standards/trace.md`。UI/API/DDL 细化随各模块进入开发阶段时补充。

| 模块 | DES | 状态 |
|------|-----|------|
| ingestion | [[modules/ingestion/DES-ingestion\|DES]] | active |
| analysis | [[modules/analysis/DES-analysis\|DES]] | active |
| evidence | [[modules/evidence/DES-evidence\|DES]] | active |
| learning | [[modules/learning/DES-learning\|DES]] | active |
| defend | [[modules/defend/DES-defend\|DES]] | active |
| challenge | [[modules/challenge/DES-challenge\|DES]] | active |
| platform | [[modules/platform/DES-platform\|DES]] | active |
| regression | [[modules/regression/DES-regression\|DES]] | active |

## 与 Requirements（Obsidian 双链）

### L1 模块

| 设计模块 | 需求 L1 |
|----------|---------|
| ingestion | [[01-Requirements/modules/ingestion/ingestion\|ingestion]] |
| analysis | [[01-Requirements/modules/analysis/analysis\|analysis]] |
| evidence | [[01-Requirements/modules/evidence/evidence\|evidence]] |
| learning | [[01-Requirements/modules/learning/learning\|learning]] |
| defend | [[01-Requirements/modules/defend/defend\|defend]] |
| challenge | [[01-Requirements/modules/challenge/challenge\|challenge]] |
| platform | [[01-Requirements/modules/platform/platform\|platform]] |
| regression | [[01-Requirements/modules/regression/regression\|regression]] |

### UI 细化（开发阶段补充）

| 模块 | UI | 代码落点 | 状态 |
|------|-----|----------|------|
| analysis | [[modules/analysis/ui/p1-loop/UI\|P1 最小闭环]] | `src/app/project/[id]/page.tsx` | active |

### 设计总览

- [[01-Requirements/Requirements-Graph|Requirements Graph]]

## 关联

- [[01-Requirements/Requirements-Graph]]
- [[overview]]
- [[standards/trace]]
