---
project: proj-analysis-learner
type: dev-task
parent: "[[01-Requirements/modules/evidence/model/model|evidence/model]]"
date: 2026-10-27
status: done
phase: be-dev
batch: P1 结论层
---

# BE-claims · 结论层写入者（claims + claim_evidence）

## 目标

在 P1 已有产物（`flows` / `flow_steps` / `evidence`）之上补齐**结论层**：让 `claims` 与 `claim_evidence` 第一次拥有真实写入者，并在项目页可见。全程不依赖模型密钥——结论由确定性规则从已有证据推导。

## 范围（Known Impact）

| 文件 | 动作 | 影响 |
| --- | --- | --- |
| `src/lib/claims.ts` | 新建 | `persistClaims(projectId, analysisVersion)`：单事务按版本整体替换结论与链接 |
| `src/lib/db/index.ts` | 改 | `deleteProjectData` 补删 `claim_evidence` / `claim_dependencies`（它们无 `project_id`，只能经 `claims` 子查询定位；`foreign_keys=ON` 下必须先删子表） |
| `worker/worker.ts` | 改 | 两条阶段链各加一个 `claims` 阶段（scan 链末位；map 链在 `flows` 之后、`nodes` 之前） |
| `src/app/api/projects/[id]/claims/route.ts` | 新建 | 只读端点，返回结论 + 支撑证据（`supports`） |
| `src/app/project/[id]/page.tsx` | 改 | 证据卡之后新增「结论层」区块 |
| `scripts/regression.ts` | 改 | 结论层断言（行数 / 状态 / derivation / support_role / 幂等） |
| `e2e/api/p1-api.spec.ts` | 改 | 新增 API-17 |
| `e2e/p1-loop.spec.ts` | 改 | 新增 S8 |

不改 DDL、不改 `evidence` / `symbols` 表结构、不引入 LLM。

## 关键设计

1. **结论不是证据的同义复述**。一条证据只说「某文件某行有个端点」；一条结论说「这条端到端流程由哪几步组成」或「这个端点没有被任何流程用到」。前者进 `evidence`，后者进 `claims`，二者经 `claim_evidence` 多对多连接。
2. **review_state 由确定性规则判定**，不由模型打分：流程结论只有在**每一步都能对上一条证据行**时才 `supported`，否则 `draft`（draft 就是「结论未被证据完整支撑」，不是「失败」）。端点结论因直接来自证据行，恒为 `supported`。
3. **derivation 区分推导强度**：流程结论 `inferred`（由多条证据合起来推断），端点结论 `direct_extraction`（直接抽取）。confidence 分别 0.8 / 1.0。
4. **按版本整体替换**：删除键 `project_id + analysis_version`，先删 `claim_evidence` → `claim_dependencies` → `claims`，再插。同一版本重跑结果稳定，不漂移（回归里有幂等断言）。
5. **claim_dependencies 本轮不写**：结论之间的依赖关系（哪条结论依赖哪条）需要 P2 的节点/边模型才能定型，本轮只建表不填（见 Decision-Register D-4）。
6. **claims 阶段排在确定性阶段末尾**：它只读 `evidence` 与 `flows`，不读模型产物，因此无 Key 时照常产出，不会被降级波及。

## 执行记录

```
npx tsc --noEmit                     → TSC_EXIT=0
npm run regression                   → 回归 PASS：fixture1 全部检查通过（symbols=3 evidence=3 flows=2 steps=9 claims=3 links=3 skipped=0）
npx playwright test（全量 24 用例）  → 24 passed (40.9s)，PW_EXIT=0
```

worker 两条链自测（fixture1）：

```
scan: {"version":"scan-v2","status":"completed","stage":"done","step":"claims:done",
       "progress_note":"files=6 symbols=3 symbolsSkipped=0 evidence=3 evidenceSkipped=0 claims=3 claimsSkipped=0 claimLinks=3",
       "dbClaims":3,"dbLinks":3}
map : {"version":"map-v1","status":"completed","stage":"done","step":"practice:done",
       "progress_note":"symbols=3 symbolsSkipped=0 evidence=3 evidenceSkipped=0 flows=2 flowsSkipped=0 claims=3 claimsSkipped=0 claimLinks=3 nodes=0 terms=0 practice=0",
       "dbClaims":3,"dbLinks":3}
```

库内终态：`claims=3`（draft 2 / supported 1）、`claim_evidence=3`（`defines` ×1、`step:1` ×1、`step:4` ×1）、`claim_dependencies=0`；`integrity_check=ok`、`foreign_key_check` 0 行。

**负向对照（证明断言非假阳性）**

| 对照 | 注入的错 | 得到的失败 |
| --- | --- | --- |
| A | `claims.ts` 的 `supported ? "supported" : "draft"` 改成无条件 `"supported"` | `npm run regression` → 回归 FAIL（2）：`流程结论 review_state 应为 draft（步骤未被证据完整支撑）：实际 supported —— 业务流程「POST /api/tasks 写入流程」共 6 步…`；`--grep S8` → 1 failed：`Expected substring: "1 条 supported"` / 实得 `结论层3 条 supported · 0 条 draft` |
| B | `claims.ts` 加 `if (process.env.NEG_B === "1") continue;` 跳过端点结论 | `NEG_B=1 npm run regression` → 回归 FAIL（4）：`claims 行数不符：实际 2，预期 3` / `claim_evidence 行数不符：实际 2，预期 3` / `证据结论数不符：实际 0，预期 1` / `claim_evidence support_role 不符：实际 step:1,step:4，预期 defines,step:1,step:4`；`--grep API-17` → 1 failed：`Expected length: 3 / Received length: 2` |

两次对照后均已还原并复跑通过。

## 待测清单

| ID | 待测点 | 覆盖 |
| --- | --- | --- |
| B9 | `GET /api/projects/[id]/claims` 返回 3 条结论，`review_state` 集合为 draft×2 + supported×1 | API-17 |
| B10 | 流程结论 `derivation=inferred`、`review_state=draft`、content 以「业务流程「」开头、`supports` 非空 | API-17 |
| B11 | 端点结论 `derivation=direct_extraction`、`review_state=supported`、content 含 `GET /api/tasks` 与 `src/server/index.ts:7` | API-17 |
| B12 | 所有 `supports` 的 `file_path` 非空、`start_line > 0` | API-17 |
| B13 | `?version=ghost-v0` 返回空集，不回落最新版本 | API-17 |
| F9 | 结论层区块可见：标题「结论层」、副标题含 `1 条 supported` 与 `2 条 draft`、`ul > li` 恰 3 条 | S8 |
| F10 | supported 与 draft 不被混同：流程结论条目含 `draft` / `inferred` / `src/server/index.ts:12`；端点结论条目含 `supported` / `direct_extraction` / `src/server/index.ts:7` | S8 |

## 延期与风险

- **D-4（新登记）**：`claim_dependencies` 只建表未写入——结论间依赖需要 P2 节点/边模型定型后才可确定。重新评估条件：nodes/edges 阶段开工时。
- **D-1 状态变化**：本轮建立了 `claims → evidence` 的连接键（`claim_evidence`），但 `symbols ↔ evidence` 仍无连接键，D-1 后半维持未解决。
- **结论类型只覆盖两类**：业务流程级 + 未覆盖端点级。模块级 / 知识点级结论要等 LLM 与 nodes 阶段。
- **UI 截断**：结论层只显示前 20 条（`slice(0, 20)`），无分页。

## 关联

| 类型 | 链接 |
| --- | --- |
| 需求 | [[01-Requirements/modules/evidence/model/model\|evidence/model]] |
| 设计 | [[02-Design/modules/evidence/DES-evidence\|DES-evidence]] · [[02-Design/modules/analysis/DES-analysis\|DES-analysis]] |
| UI | [[02-Design/modules/analysis/ui/p1-loop/UI\|UI-p1-loop]] |
| 代码 | [[03-Code/modules/analysis/BE-claims\|BE-claims]] |
| 测试 | [[05-Test-Tasks/specs/BE-API-PLAN-p1-api\|BE-API-PLAN-p1-api]] · [[05-Test-Tasks/FE-PW-PLAN-p1-loop\|FE-PW-PLAN-p1-loop]] |
| 决策登记 | [[Decision-Register\|D-1 / D-4]] |

## 下一步

1. 结论层的三类剩余结论（模块级 / 知识点级 / 术语级）依赖 nodes 与 LLM，需先配 API Key。
2. `claim_dependencies` 与 `edges` 的写入随 P2 建边阶段一并落地。
3. 结论层目前无「人工复核」入口（`review_state` 只读不可改），人工复核动作属 P3 学习体验阶段。
