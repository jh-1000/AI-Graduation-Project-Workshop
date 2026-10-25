---
project: proj-analysis-learner
type: decision-register
date: 2026-10-25
updated: 2026-10-25
---

# Decision Register

本文件只登记 **DEFERRED** 与 **DEPENDENCY_UNCERTAIN** 两类决策，按 `decision-protocol.md` §6 的七字段格式记录。已决（RESOLVED）与已确认（READY）的决策不在此登记，只在对应 SPEC/DES 与 `log.md` 中留痕。

## 索引

| ID | 主题 | 类型 | 状态 | 首次登记 |
| --- | --- | --- | --- | --- |
| D-1 | symbols 版本列（已补）与 symbols↔evidence 连接键（未补） | DEFERRED | 部分解决 | 2026-10-25 |
| D-2 | evidence 跨版本堆积、无唯一约束 | DEFERRED | 未解决 | 2026-10-25 |
| D-3 | evidence 未区分写入阶段（无 stage/kind 列） | DEFERRED | 未解决 | 2026-10-25 |
| U-1 | origin 是来源维度，不承担阶段语义 | DEPENDENCY_UNCERTAIN | 观察中 | 2026-10-25 |

---

## D-1 · symbols 版本列与 symbols↔evidence 连接键

**状态更新（2026-10-25，P1 批次）**：前半已解决——`0002_map_learning.sql` 首行 `ALTER TABLE symbols ADD COLUMN analysis_version TEXT;`，`persistSymbols` 已改为写入并按键 `project_id + analysis_version + identify_by='ts-morph'` 删除，符号现在随 run 版本落库。**后半仍未解决**：symbols 与 evidence 之间仍无连接键，符号无法回指某条证据。

- **原因**：`src/lib/db/migrations/0001_init.sql:39-49` 的 symbols 表原无版本列；evidence 表（`:80-92`）也没有 `symbol_id`。0002 只补了版本列，没有补连接键。
- **当前风险**：与 `_slots/project-invariants.md:19`「每条分析结论必须携带证据与 analysis_version」仍存在部分冲突——版本已具备，证据引用仍缺。当前 symbols 是「符号清单」而非「结论」，尚未触发该条款；一旦 P2 用它生成结论，冲突即成立。
- **当前闭环影响**：不影响 P0/P1 闭环——证据落库与 UI 回读都不依赖符号→证据的引用。
- **后续批次**：P2（失效传播与 nodes 建边时一并设计）。
- **前置条件**：确定连接方式（evidence 加 `symbol_id`，或建 `symbol_evidence` 关联表）；确认 symbols 是否需要保留历史版本（当前是覆盖写，只留最新版本）。
- **延期合理性**：连接键的形态取决于 P2 的结论模型（nodes/edges）如何引用符号；在结论模型定型前加连接键会锁死设计。
- **重新评估条件**：失效传播（invalidation）开工前必须解决，否则无变更基线可比。

## D-2 · evidence 跨版本堆积、无唯一约束

- **原因**：evidence 表无 `UNIQUE` 约束，同一 `(project_id, analysis_version)` 下同一端点可重复插入。当前靠 `src/lib/evidence.ts` 的 delete-then-insert（删除键 `project_id + analysis_version + note LIKE 'endpoint:%'|'route:%'`）保证幂等。
- **当前风险**：若将来有第二个写入方在同版本写入同类 note 前缀，删除会越界；跨版本行会持续累积，读取方若不过滤 `analysis_version` 会看到多份重复证据。
- **当前闭环影响**：不影响——现有唯一读取方 `scripts/regression.ts` 已按 `project_id + analysis_version` 过滤。
- **后续批次**：P2。
- **前置条件**：确定证据的版本生命周期（保留全部历史 / 只保留 latest / 归档到冷表）。
- **延期合理性**：唯一约束一旦加上，未来保留历史版本的方案就被锁死；当前数据量小，删除键足够安全。
- **重新评估条件**：出现第一个「不按版本过滤」的读取方之前。

## D-3 · evidence 未区分写入阶段（无 stage/kind 列）

- **原因**：evidence 表只有 `origin`（来源：source_code/static_analyzer/llm/user/runtime/unknown），没有「哪个分析阶段写的」这一维度。本轮用 `note` 前缀（`endpoint:` / `route:`）区分，并把该前缀同时当作删除判别键。
- **当前风险**：前缀是字符串约定而非 schema 约束，后续写入方若忘记前缀约定，删除逻辑会漏删或误删。
- **当前闭环影响**：不影响。
- **后续批次**：P2。
- **前置条件**：确认阶段维度是否应并入 origin，或独立成 `stage` 列。
- **延期合理性**：现在只有 static_analyzer 一个写入方，加列属过早抽象（YAGNI）。
- **重新评估条件**：同版本内出现第二个 static_analyzer 写入方之前。

## U-1 · origin 是来源维度，不承担阶段语义

- **不确定性**：`origin='static_analyzer'` 同时覆盖了「正则抽端点」和「ts-morph 抽符号」两类产物，若未来把符号也写成 evidence，二者在库里无法区分。
- **当前处置**：本轮符号只进 symbols 表，不进 evidence，暂不触发。
- **重新评估条件**：决定符号是否也需要 evidence 行时。
