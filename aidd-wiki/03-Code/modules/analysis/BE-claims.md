---
project: proj-analysis-learner
type: code-module
parent: "[[02-Design/modules/evidence/DES-evidence|DES-evidence]]"
date: 2026-10-27
status: active
---

# BE-claims · 结论层代码位置（claims / claim_evidence）

## 模块边界

负责把**已有证据与流程**折叠成可读结论，并维护结论 ↔ 证据的多对多连接。不做抽取（那是 `evidence.ts` / `flows.ts` 的职责），不做自然语言生成（那是 `llm/analyze.ts` 的职责）。

输入：`flows`、`flow_steps`、`evidence`（同一 `project_id` + `analysis_version`）。
输出：`claims`、`claim_evidence`。

## 代码位置

| 项 | 位置 |
| --- | --- |
| 落库实现 | `src/lib/claims.ts`（122 行） |
| 对外入口 | `persistClaims(projectId: number, analysisVersion: string): ClaimPersistResult`（`claims.ts:23`） |
| 返回类型 | `ClaimPersistResult = { inserted: number; skipped: number; linked: number }`（`claims.ts:3`） |
| 定位键 | `locKey(file, line)`（`claims.ts:10`）→ `"file:line"`，与 `evidence` 落库口径一致 |
| worker 调用 | `worker/worker.ts` 的 `if (from("claims"))` 段 |
| 只读端点 | `src/app/api/projects/[id]/claims/route.ts` |
| UI 区块 | `src/app/project/[id]/page.tsx:369-409`（「结论层」section） |
| 回归断言 | `scripts/regression.ts` 结论层断言段 |
| 测试 | `e2e/api/p1-api.spec.ts` API-17；`e2e/p1-loop.spec.ts` S8 |

## 结论生成规则（确定性，无模型）

| 结论类型 | 触发条件 | derivation | review_state | confidence | subject |
| --- | --- | --- | --- | --- | --- |
| 业务流程结论 | 该 flow 至少 1 步 | `inferred` | 每步都对上 evidence 行 → `supported`；否则 `draft` | 0.8 | `flow` + `flows.id` |
| 未覆盖端点结论 | 该 evidence 未被任何流程步骤引用 | `direct_extraction` | `supported` | 1.0 | `evidence` + `evidence.id` |

内容模板（原文）：
- 流程：`业务流程「<title>」共 <n> 步：<step1> → <step2> → …`
- 端点：`端点 <note> 定义于 <file:line>，未进入任何确定性业务流程`

`claim_evidence.support_role` 取值：流程结论用 `step:<seq>`，端点结论用 `defines`。

## 幂等与清理

- 删除键：`claims.project_id + claims.analysis_version`；顺序 `claim_evidence` → `claim_dependencies` → `claims`（子表先删，`foreign_keys=ON`）。
- 整个删除 + 插入在单个 `db.transaction` 内（`claims.ts:64`），调用方不包事务。
- `deleteProjectData`（`src/lib/db/index.ts`）已补删两张无 `project_id` 的子表，经 `claims` 子查询定位。

## 阶段位置

| 链 | 阶段顺序 |
| --- | --- |
| `kind='scan'` | scan → symbols → evidence → **claims** |
| `kind='map'` | symbols → evidence → flows → **claims** → nodes → terms → practice |

claims 排在确定性阶段末尾、模型阶段之前：只依赖 evidence + flows，无 Key 时照常产出。

## 已知缺口

- `claim_dependencies` 零写入（D-4）：结论间依赖待 P2 节点/边模型定型。
- `symbols ↔ evidence` 仍无连接键（D-1 后半）：符号无法作为结论的支撑证据。
- 结论类型只有两类：模块级 / 知识点级 / 术语级结论需要 nodes 与 LLM。
- `review_state` 只读不可改：无人工复核入口（P3）。
- UI 只显示前 20 条结论（`slice(0, 20)`），无分页。

## 关联

- 设计：[[02-Design/modules/evidence/DES-evidence|DES-evidence]] · [[02-Design/modules/analysis/DES-analysis|DES-analysis]]
- 同类代码文档：[[03-Code/modules/analysis/BE-evidence|BE-evidence]] · [[03-Code/modules/analysis/BE-p1-loop|BE-p1-loop]]
- 开发记录：[[04-Dev-Tasks/BE-claims|BE-claims]]
- 决策登记：[[Decision-Register|D-1 / D-4]]
