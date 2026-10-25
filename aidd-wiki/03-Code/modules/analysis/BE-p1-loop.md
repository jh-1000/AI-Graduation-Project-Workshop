---
project: proj-analysis-learner
type: Code
parent: "[[02-Design/modules/analysis/DES-analysis|DES-analysis]]"
date: 2026-10-25
---

# modules/analysis · BE-p1-loop（map 阶段链与 P1 产物落库）

## 模块边界

在 BE-evidence 的落库层之上，补齐「业务流程 / 知识节点 / 术语 / 练习」四类产物的生成与写入，并把 worker 从单链扩展为双链。输入是 `files` 的正文快照与已落库的 `evidence`；输出是 `flows` / `flow_steps` / `nodes` / `terms` / `practice_items` 行，以及无 Key 时的 `open_questions`。不负责调度（`src/lib/tasks.ts`）与读取端点（`src/app/api/`）。

## 代码位置

| 文件 | 职责 |
| --- | --- |
| `src/lib/db/migrations/0002_map_learning.sql` | `symbols` 加 `analysis_version`；建 6 张 P1 表 |
| `src/lib/flows.ts` | `detectFlows`（确定性六锚点追踪）/ `persistFlows`（单事务 delete-then-insert） |
| `src/lib/llm/analyze.ts` | `analyzeNodes` / `analyzeTerms` / `analyzePractice`；`hasApiKey` / `recordOpenQuestion`；无 Key 降级 |
| `src/lib/llm/client.ts` | `chatJSON` 接入 `buildContext`（出站过滤器）；`context` / `maxContextChars` 选项 |
| `src/lib/evidence.ts` | `persistSymbols(projectId, analysisVersion, symbols)`，删除键与写入都带版本 |
| `src/lib/db/index.ts` | `deleteProjectData(projectId)`，17 张表按外键顺序单事务清理 |
| `worker/worker.ts` | 双链：`SCAN_STAGES` / `MAP_STAGES`；`from(stage)` 决定起点 |

## 阶段链与恢复语义

```text
kind='scan'  SCAN_STAGES = scan → symbols → evidence
kind='map'   MAP_STAGES  = symbols → evidence → flows → nodes → terms → practice
```

- 两条链共用 `analysis_runs.stage` 记录位置；worker 启动时 `startIndex = stages.indexOf(run.stage)`（`run.stage` 不在链中则为 0），之后 `from(s) = stages.indexOf(s) >= startIndex` 决定某阶段是否执行。
- map 链不重扫文件：直接复用 `files.content_hash` 与磁盘正文，因此 map 可以在 scan 完成后单独触发。
- `flows` / `nodes` / `terms` / `practice` 都是**一次性全量阶段**（无分批 checkpoint）；`scan` / `symbols` / `evidence` 保留分批与 `note(stage, step, text)` 心跳。
- 抢占语义不变：`UPDATE ... WHERE id=? AND status IN ('queued','paused')`，影响 0 行即 `exit(0)`，重复 spawn 不会把正常 run 误标 `failed`。

## 数据契约

| 表 | 写入字段 | 删除键 |
| --- | --- | --- |
| `symbols` | `project_id`、`analysis_version`（= `run.version`）、`file_id`（由 files 反查）、`name`、`kind`、`line`、`identify_by='ts-morph'`、`precision='exact'` | `project_id + analysis_version + identify_by='ts-morph'` |
| `evidence` | `origin='static_analyzer'`、`processing='extracted'`、`freshness='current'`、`note` = `endpoint: <M> <P>` / `route: <P>` | `project_id + analysis_version + note LIKE 'endpoint:%' OR 'route:%'` |
| `flows` / `flow_steps` | `confidence=0.8`、`status='draft'`、`seq` 从 1、`start_line=end_line` | `project_id + analysis_version`（flows）；`flow_id NOT IN (子查询)`（flow_steps） |
| `nodes` | `status='pending_review'`、`sections` JSON、`summary` 截断 2000、`evidence_note` 截断 500 | `project_id + analysis_version` |
| `terms` | `status='draft'`、`version_note` = 版本；`ON CONFLICT(project_id, slug) DO UPDATE` | 不删（跨版本 upsert） |
| `practice_items` | `status='pending_review'`、`hints` JSON；`locate` 才有 `target_file` / `target_line` | `project_id + analysis_version` |
| `open_questions` | `question` / `why` / `next_check`（无 Key 或 LLM 失败时） | 不删 |

## 无 Key 降级语义

`analyze.ts` 的 `runLlm` 在三种情况返回 `null` 而不抛异常：无 API Key、`chatJSON` 抛错、zod 校验失败。每次降级写一条 `open_questions`，`next_check` 固定为「到设置页填写 API Key 后重跑 map 任务」。调用方据此返回 `{ ok:false, inserted:0, reason }`，worker 只累加计数，任务仍能走到 `completed`——降级是设计内状态，不是失败。

## 关联

- 设计：[[02-Design/modules/analysis/DES-analysis|DES-analysis]] · [[02-Design/modules/evidence/DES-evidence|DES-evidence]]
- 需求：[[01-Requirements/modules/analysis/map-pipeline/map-pipeline|map-pipeline]] · [[01-Requirements/modules/learning/practice/practice|practice]] · [[01-Requirements/modules/learning/terms/terms|terms]] · [[01-Requirements/modules/learning/node-page/node-page|node-page]]
- UI：[[02-Design/modules/analysis/ui/p1-loop/UI|UI]]
- 开发记录：[[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]] · [[04-Dev-Tasks/BE-evidence|BE-evidence]]
- 决策登记：[[Decision-Register|Decision-Register]]

## 已知缺口

- `symbols` 与 `evidence` 之间仍无连接键（D-1 后半）；`flow_steps.evidence_id` 与 `practice_items.evidence_id` 列已建但本轮不写入。
- `evidence` 无唯一约束、跨版本堆积（D-2）；写入阶段靠 `note` 前缀约定区分（D-3）。
- `claims` / `claim_evidence` / `claim_dependencies` / `edges` / `coverage_stats` / `repo_insights` / `history_events` 仍是零写入者。
- 业务流程追踪只覆盖同仓、同语言、正则可定位的调用链；跨语言或动态派发场景需要换模型（见 [[04-Dev-Tasks/FE-p1-loop|FE-p1-loop]] 关键设计 2）。
- `analyzeNodes` 的上下文只取 `parse_mode='parsed'` 且 `ORDER BY loc DESC LIMIT 20` 的 20 个文件，无 PageRank 选料（DES-analysis:11 的 `src/lib/repomap.ts` 未实现）。