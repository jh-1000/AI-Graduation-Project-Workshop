---
project: proj-analysis-learner
type: Code
parent: "[[01-Requirements/modules/learning/learning|learning]]"
date: 2026-10-29
status: active
phase: be-dev
---

# BE-learning-upgrades · 学习升级三接口（probe / alternatives / techpath）

10-29 学习升级批次的后端实现布局与关键决策。任务范围与执行记录见 [[04-Dev-Tasks/FE-learning-upgrades|FE-learning-upgrades]]。

## 接口一览

| 端点 | 方法 | 依赖 | 降级行为 |
| --- | --- | --- | --- |
| `/api/projects/[id]/probe` | POST | 无 LLM；可选 verifyCommand（需 `allow_modify` + node_modules） | 无验证命令 → `verify.status="not_run"`，diff 与 insight 照常返回 |
| `/api/projects/[id]/alternatives` | POST | chatJSON（LLM）+ zod | 无 Key → 400；模型输出不合 schema → 502（maxRetries=1） |
| `/api/projects/[id]/techpath` | GET | 无 | 无数据 → `{ analysisVersion: null, paths: [] }`，不 404 |

## 关键实现决策

1. **probe 的隔离边界**（`probe/route.ts`）：原文件全程只读；变异内容写入 `data/probe/probe-<Date.now()>/` 下的相对路径副本，`finally` 中 `rmSync` 兜底清理——即使验证命令抛错也不留临时目录、不碰源码。与 challenge 的 `startWorkspace` 隔离工作区是两套机制：probe 是单文件行级实验（秒级、无构建），challenge 是整库改码双轨（有验证有回滚）。
2. **probe 的验证语义**：`verifyOk` 三态（`passed/failed/not_run`）。验证失败被表述为教学结果而非错误——`insight` 文案区分三种情况；类型检查通过 ≠ 运行时正确的提醒写死在文案里。
3. **alternatives 的防护链**（`alternatives/route.ts`）：`realpathSync(abs)` 后校验 `startsWith(root)`（403 越界）→ 片段截取（`startLine/endLine`）→ 6000 字符截断（prompt 预算）；`AltSchema` 用 `.min(2).max(3)` 约束方案数，`chosen` 由模型标记当前项目采用项；system prompt 显式给出精确英文键 JSON 形状（D-6 约定）。
4. **techpath 的版本口径**（`techpath/route.ts`）：取 `tech_paths` 最新 `analysis_version`（`ORDER BY id DESC LIMIT 1`）而非最新 map run 版本——数据由 map 链按版本整体写入，两口径在"最新"语义上等价且端点无需 join `analysis_runs`；`tech_path_items.prereq_item_id` 自引用表达概念前置链，UI 按 `seq` 渲染。
5. **DDL 0007 幂等键**：`UNIQUE(project_id, analysis_version, tech_name)` + `UNIQUE(path_id, seq)`，map 重跑按版本整体替换不漂移（与 claims/flows 的按版本替换惯例一致）。

## 关联

- [[04-Dev-Tasks/FE-learning-upgrades|FE-learning-upgrades]]（批次任务与验证）
- [[02-Design/modules/learning/DES-learning|DES-learning]]（学习闭环设计）
- [[06-发布/REL-2026-10-29-learning-upgrades|REL-2026-10-29]]（发布说明）
