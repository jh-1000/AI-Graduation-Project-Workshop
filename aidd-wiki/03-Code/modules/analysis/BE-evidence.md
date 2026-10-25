---
project: proj-analysis-learner
type: Code
parent: "[[02-Design/modules/analysis/DES-analysis|DES-analysis]]"
date: 2026-10-25
---

# modules/analysis · BE-evidence（证据写入链路）

## 模块边界

分析引擎的落库层。输入是「内存里抽好的符号/端点/路由」，输出是 `symbols` 与 `evidence` 表的行。不负责抽取（`src/lib/symbols.ts`、`src/lib/scan.ts`），不负责调度（`src/lib/tasks.ts`、`worker/worker.ts`）。

## 代码位置

| 文件 | 职责 |
| --- | --- |
| `src/lib/evidence.ts` | `persistSymbols` / `persistEvidence`，delete-then-insert 单事务 |
| `worker/worker.ts` | 三阶段流水线：scan（分批断点）→ symbols（分批抽取、整体落库）→ evidence（分批抽取、整体落库） |
| `src/lib/symbols.ts` | ts-morph 符号抽取（不改动） |
| `src/lib/scan.ts` | 正则端点/路由抽取 + `isTextFile` 口径（不改动） |

## 数据契约

- symbols：`project_id`、`file_id`（由 files 反查）、`name`、`kind`、`line`、`identify_by='ts-morph'`、`precision='exact'`
- evidence：`project_id`、`analysis_version`（= `analysis_runs.version`）、`file_path`、`start_line`/`end_line`、`content_hash`（= files 快照）、`origin='static_analyzer'`、`processing='extracted'`、`freshness='current'`、`note`（`endpoint:` / `route:` 前缀）

## 恢复语义

- 阶段推进只写 `analysis_runs.stage/step`：`file:<n>/<total>` → `symbols:<n>/<total>` → `evidence:<n>/<total>` → `stage='done'`
- 被强杀后由 `recoverStaleRuns` 把 running 改回 queued，worker 重启时按 `run.stage` 从对应阶段起点续跑
- 起点规则：`stage` 为空或 `scan` → 全跑；`symbols` → 跳过 scan；`evidence` → 跳过 scan 与 symbols；终态 run 再 spawn 直接退出

## 关联

- 设计：[[02-Design/modules/analysis/DES-analysis|DES-analysis]] · [[02-Design/modules/evidence/DES-evidence|DES-evidence]]
- 需求：[[01-Requirements/modules/evidence/evidence|evidence]]
- 开发记录：[[04-Dev-Tasks/BE-evidence|BE-evidence]]
- 决策登记：[[Decision-Register|Decision-Register]]

## 已知缺口

- symbols 无 `analysis_version`，与 evidence 无连接键（D-1）
- evidence 无唯一约束，跨版本堆积（D-2）
- 证据未区分写入阶段，靠 note 前缀约定（D-3）
- UI 与 API 尚无读取方：`src/app` 下 symbols/evidence 零命中
