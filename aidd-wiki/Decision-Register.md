---
project: proj-analysis-learner
type: decision-register
date: 2026-10-25
updated: 2026-10-28
---

# Decision Register

本文件只登记 **DEFERRED** 与 **DEPENDENCY_UNCERTAIN** 两类决策，按 `decision-protocol.md` §6 的七字段格式记录。已决（RESOLVED）与已确认（READY）的决策不在此登记，只在对应 SPEC/DES 与 `log.md` 中留痕。

## 索引

| ID | 主题 | 类型 | 状态 | 首次登记 | 最近更新 |
| --- | --- | --- | --- | --- | --- |
| D-1 | symbols 版本列 + symbols↔evidence 直接连接键 | DEFERRED | **已关闭** → 见文末 Closed；残留清理转 D-8 | 2026-10-25 | 2026-10-28 |
| D-2 | evidence 跨版本堆积、无唯一约束 | DEFERRED | 未解决 · **重新评估条件已触发** | 2026-10-25 | 2026-10-28 |
| D-3 | evidence 未区分写入阶段（stage 列） | DEFERRED | 部分缓解（列已在，主写入方未用） | 2026-10-25 | 2026-10-28 |
| D-4 | claim_dependencies 只建表未写入 | DEFERRED | 未解决（前置已部分就位） | 2026-10-27 | 2026-10-28 |
| D-5 | AI SDK 已移除，LLM 客户端维持自研 | DEFERRED | 维持（重评条件未触发） | 2026-10-27 | 2026-10-28 |
| D-6 | GLM 系不遵守英文 JSON 键，prompt 需显式键名 | DEFERRED | 已缓解（缓解面扩大到 ask） | 2026-10-27 | 2026-10-28 |
| D-7 | 离线 Whisper 转写层推迟 | DEFERRED | 维持未解决 | 2026-10-27 | 2026-10-28 |
| D-8 | `evidence.symbol_id` 死列（0003 加列后 0 写 0 读） | DEFERRED | **本轮新增登记** | 2026-10-28 | 2026-10-28 |
| U-1 | origin 是来源维度，不承担阶段语义 | DEPENDENCY_UNCERTAIN | 观察中 | 2026-10-25 | 2026-10-28 |

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

**状态更新（2026-10-27，P1 结论层批次）**：`claims → evidence` 的连接键已建立（`claim_evidence` 表由 `src/lib/claims.ts` 首次写入，3 条结论各挂 1 条支撑证据）。**但这不解决 D-1 后半**：D-1 讲的是 `symbols ↔ evidence`，符号仍无法回指证据行。

## D-2 · evidence 跨版本堆积、无唯一约束

- **原因**：evidence 表无 `UNIQUE` 约束，同一 `(project_id, analysis_version)` 下同一端点可重复插入。当前靠 `src/lib/evidence.ts` 的 delete-then-insert（删除键 `project_id + analysis_version + note LIKE 'endpoint:%'|'route:%'`）保证幂等。
- **当前风险**：若将来有第二个写入方在同版本写入同类 note 前缀，删除会越界；跨版本行会持续累积，读取方若不过滤 `analysis_version` 会看到多份重复证据。
- **当前闭环影响**：不影响——现有唯一读取方 `scripts/regression.ts` 已按 `project_id + analysis_version` 过滤。
- **后续批次**：P2。
- **前置条件**：确定证据的版本生命周期（保留全部历史 / 只保留 latest / 归档到冷表）。
- **延期合理性**：唯一约束一旦加上，未来保留历史版本的方案就被锁死；当前数据量小，删除键足够安全。
- **重新评估条件**：出现第一个「不按版本过滤」的读取方之前。

**状态更新（2026-10-28，重新评估已执行）**：**重新评估条件已触发**——出现两个不按 `analysis_version` 过滤的读取方：`src/app/api/projects/[id]/route.ts:61`（`SELECT COUNT(*) n FROM evidence WHERE project_id = ?`，项目页证据总数）与 `src/app/api/projects/[id]/graph/route.ts:58`（`SELECT DISTINCT file_path FROM evidence WHERE project_id = ? AND freshness = 'stale'`，图谱失效视图基础）。同批其余 3 处（`evidence/route.ts:26`、`coverage.ts:59`、`scripts/regression.ts:135`）均已过滤。
- **当前风险变更**：低 → **中**。多 run 项目下项目页证据计数含历史版本（偏高）；图谱 stale 标记可能把旧版本的 stale 文件照到新版本节点上。
- **当前闭环影响变更**：原「不影响」不再成立——P5 失效视图与项目页统计已成为受影响面。
- **后续批次**：P2（原计划）→ **下一个 be-dev 批次必须处理**（两处读取方补版本过滤；若产品上希望展示跨版本总数则明确写死语义）。
- Source：[[06-发布/REL-2026-10-28-p2-p5-closure|REL-2026-10-28-p2-p5-closure]]
## D-3 · evidence 未区分写入阶段（无 stage/kind 列）

- **原因**：evidence 表只有 `origin`（来源：source_code/static_analyzer/llm/user/runtime/unknown），没有「哪个分析阶段写的」这一维度。本轮用 `note` 前缀（`endpoint:` / `route:`）区分，并把该前缀同时当作删除判别键。
- **当前风险**：前缀是字符串约定而非 schema 约束，后续写入方若忘记前缀约定，删除逻辑会漏删或误删。
- **当前闭环影响**：不影响。
- **后续批次**：P2。
- **前置条件**：确认阶段维度是否应并入 origin，或独立成 `stage` 列。
- **延期合理性**：现在只有 static_analyzer 一个写入方，加列属过早抽象（YAGNI）。
- **重新评估条件**：同版本内出现第二个 static_analyzer 写入方之前。

**状态更新（2026-10-28）**：**部分缓解**，风险未消除。已做到：`0003` 已 `ADD COLUMN stage TEXT NOT NULL DEFAULT 'static'`；`src/lib/lockfile.ts:33` 写入 `stage='lockfile'`。未做到：主写入方 `src/lib/evidence.ts:60` 的 INSERT 字段列表**不含 stage**（吃默认值 `static`），`:57` 仍以 `note LIKE 'endpoint:%' OR note LIKE 'route:%'` 作删除判别键 → **前缀约定风险原样存在**；migration 注释承论的 `flow`/`llm`/`manual` 三值**无生产者**，`idx_evidence_stage` 目前只覆盖默认值。
- **重新评估条件已部分触发**：第二个 static_analyzer 写入方（lockfile 依赖证据）**已出现**，它靠 `stage` 而不靠前缀 —— 两种机制现已共存。
- **后续批次**：P2 → **P3（下一个 be-dev）**：`evidence.ts` 写入方补 `stage`，删除键从 `note LIKE` 改为 `stage`。

**状态更新（2026-10-29，六维覆盖报告修复批）**：缓解面进一步扩大——**读取方**全部切到 `stage`：`src/lib/claims.ts`（「未进入业务流」结论查询排除 `stage='lockfile'`）、`src/lib/coverage.ts`（flows 维分母排除 lockfile 行；external_deps 维从硬编码 0/0 改为按 `stage='lockfile'` 统计，首次接上真实数据源）。同时 `worker.ts` 的 `MAP_STAGES` 补入 scan/lockfile，lockfile 阶段在 map 链获得稳定执行时机。**仍未做到**：`src/lib/evidence.ts` 写入侧 INSERT 不含 stage、删除判别键仍为 note 前缀 → 写入侧风险原样存在，本条维持**部分缓解**。证据：[[04-Dev-Tasks/BE-coverage-report|BE-coverage-report]] · [[06-发布/REL-2026-10-29-learning-upgrades|REL-2026-10-29]]
- Source：[[06-发布/REL-2026-10-28-p2-p5-closure|REL-2026-10-28-p2-p5-closure]]
## U-1 · origin 是来源维度，不承担阶段语义

- **不确定性**：`origin='static_analyzer'` 同时覆盖了「正则抽端点」和「ts-morph 抽符号」两类产物，若未来把符号也写成 evidence，二者在库里无法区分。
- **当前处置**：本轮符号只进 symbols 表，不进 evidence，暂不触发。
- **重新评估条件**：决定符号是否也需要 evidence 行时。

**状态更新（2026-10-28）**：维持观察中。`origin='static_analyzer'` 仍同时覆盖端点抽取与 lockfile 依赖（后者现靠 `stage` 区分，见 D-3）；符号至今只进 `symbols` 表，本条仍未触发。
## D-4 · claim_dependencies 只建表未写入

- **原因**：`0001_init.sql` 的 `claim_dependencies`（`claim_id` / `depends_on_claim_id`）在 P1 结论层批次仍无写入者。结论之间的依赖（「这条流程结论依赖那条模块结论」）需要 P2 的 nodes/edges 模型定型后才能确定指向关系；当前结论只有两类（流程级 / 端点级），二者之间不存在真实依赖。
- **当前风险**：若在结论模型未定型前先填依赖，会锁死后续 nodes/edges 的引用形态；同时空表会让「结论依赖图」类查询静默返回空，容易误判为「没有依赖」。
- **当前闭环影响**：不影响——UI 与回归都不读 `claim_dependencies`；删除逻辑（`claims.ts:50-52` 与 `deleteProjectData`）已按双向子查询实现，将来有数据也能正确清理。
- **后续批次**：P2（nodes / edges 建边阶段）。
- **前置条件**：确定结论与节点（nodes）的对应关系，以及「依赖」是否等价于 `edges.kind = DEPENDS_ON`。
- **延期合理性**：现在只有两类结论且互不依赖，加依赖关系属过早抽象（YAGNI）。
- **重新评估条件**：nodes/edges 阶段开工时；或出现第一条需要引用另一条结论才能成立的结论时。

**状态更新（2026-10-28）**：仍未解决（全仓 `INSERT INTO claim_dependencies` **0 命中**，`DEPENDS_ON` kind 无生产者）；但**前置已部分就位**：`src/lib/edges.ts:37` 已写入 `CONTAINS`（file→symbol）与 `IMPORTS`（file→file，带 `analysis_version`），`src/lib/llm/analyze.ts:149` 已写入带版本的 `nodes`。`edges.ts:8-10` 注释明确写「CALLS/IMPLEMENTS/RELATES_TO/EXPLAINS 留给后续」→ 结论间依赖的指向形态仍未定型，延期合理性保留。
- Source：[[06-发布/REL-2026-10-28-p2-p5-closure|REL-2026-10-28-p2-p5-closure]]

---

## D-5 · AI SDK 底座已移除，LLM 客户端维持自研

- **原因**：oss-reuse-map 曾计划把 `llm/client.ts` 换成 Vercel AI SDK（`ai` + `@ai-sdk/openai-compatible`）。审计发现这两个包已安装但 **0 处 import**（死依赖），随本轮移除。
- **当前风险**：自研客户端需自己维护重试、结构化输出与流式能力；当前 T3（结构化输出 10/10）通过，短期无风险。
- **当前闭环影响**：无——fable/defend/analyze 的 zod 校验与缓存都工作正常。
- **后续批次**：P2（若需要流式输出、工具调用或多 provider 细化时）。
- **前置条件**：先以自研客户端跑通 P2 的全部 LLM 阶段，再比较 AI SDK 的收益（流式/工具调用）是否值得迁移。
- **延期合理性**：迁移会替换已通过验证的代码路径，收益（流式）当前用不上——避免为技术栈完整而冒险。
- **重新评估条件**：需要 token 级流式输出、或接入需 function calling 的 provider 时。

**状态更新（2026-10-28）**：维持。本轮复核缺陷：全仓 `from "ai"` / `@ai-sdk` import **0 命中**（移除结论与代码一致）；新增的 3 个 LLM 接口（ask / fable / defend）均走自研 `chatJSON`，未引入流式与工具调用 → 重新评估条件**未触发**。
## D-6 · GLM 系模型不遵守英文 JSON 键

- **原因**：fable 与 defend 两个新接口首次实现时，模型按中文提示词返回了中文键（故事/揭晓/映射…），导致 zod 校验失败。
- **当前风险**：任何新增 LLM 接口若只写字段语义、不写精确键名，都可能复现。
- **当前闭环影响**：已缓解——两个 prompt 都显式给出英文键的 JSON 形状，且数值字段用 `z.coerce.number()` 容错。
- **后续批次**：持续约束（写入 llm 提示词模板约定）。
- **前置条件**：无。
- **延期合理性**：提示词约束是最小改动；引入 JSON mode/function calling 属 P2 一并评估。
- **重新评估条件**：更换模型或模型升级后回归 T3 + 两个新接口。

**状态更新（2026-10-28）**：已缓解且**缓解面扩大**——P3/P4/P5 新增的 `src/app/api/projects/[id]/ask/route.ts:146-147` 同样显式给出精确英文键的 JSON 形状（`answer` / `usedRefs` / `gap` / `nextCheck`）。建议下一个 be-dev 批次把「prompt 必须给出精确英文键」固化为 LLM 接口约定（写兪 `02-Design/standards/api.md`）；本条保持已缓解，不升级为已闭环（尚未写入规范、也未回归）。

---

## D-1 · symbols↔evidence 连接键 —— 已按设计定型解决

**结论（2026-10-27）**：不需要 symbols↔evidence 直接连接键。设计定型如下：

1. `claims ↔ evidence` 连接已建立（`claim_evidence`，claims.ts 写入，3+ 条真实数据）。
2. `evidence.symbol_id` 已在 0003 加列，但端点/路由证据是**文件级**（不绑符号）；符号本身是"索引"不是"结论"，不产生 evidence 行。
3. 节点/流程与代码的关联走 `flow_steps.file_path` 与 `nodes.evidence_note`（path:line 文本锚点），失效传播按文件路径圈定范围——不依赖符号键。

**原风险解除**：失效传播已实现并实测（1 文件变更 → 3 证据 stale → 3 结论 flagged），不依赖符号键。

**状态更新（2026-10-28，P2–P5 未入库批次收尾）**：设计结论不变（不需要直接连接键），但本轮发现一处**口径矛盾**：`0003_evidence_stage_symbol.sql:2` 头注释写「D-1：补连接键」并已 `ADD COLUMN symbol_id`，与本节「不需要该键」的结论相左。全仓复核：`symbol_id` **仅出现在该 migration 自身（src/worker/scripts/e2e 均 0 写入方、0 读取方）**，即死列。清理行为已拆为 **D-8**，本条按已闭环处理，不再占用 Open Deferred。
## D-7 · 离线 Whisper 转写层推迟

- **原因**：whisper.wasm 模型约 40-80MB 且需打包验证；原生 Web Speech 已覆盖 localhost 主场景（Chrome/Edge 免费）。
- **当前闭环影响**：无——语音作答在正式应用（localhost）原生可用。
- **后续批次**：P5 之后按需。
- **前置条件**：确定模型分发方式（随包 / 首次下载缓存）。
- **延期合理性**：避免为边缘场景引入大体积资源与打包风险。
- **重新评估条件**：用户需要彻底离线的语音作答时。

**状态更新（2026-10-28）**：维持未解决。依据：全仓 `whisper` 引用 **0 命中**（未引入，与决定一致）；原生 Web Speech 已实装 `src/app/project/[id]/defend/page.tsx:60-61`，主场景覆盖。


## D-8 · `evidence.symbol_id` 死列（0003 加列后无写入方、无读取方）

- **原因**：D-1 于 2026-10-27 按设计定型为「不需要 symbols↔evidence 直接连接键」，但 `0003_evidence_stage_symbol.sql:9` 已写 `ALTER TABLE evidence ADD COLUMN symbol_id INTEGER REFERENCES symbols(id)`，其头注释 `:2` 仍写「D-1：补连接键」—— 设计结论与 migration 说明互相矛盾，列本身留在库里。
- **当前风险**：**低**。全仓复核 `symbol_id` 仅出现在该 migration 自身，`src/`、`worker/`、`scripts/`、`e2e/` 均无写入方与读取方（本轮独立复扫，0 命中）。属无害冗余列，不产生错误行为。
- **当前闭环影响**：不影响任何已实现功能（失效传播与结论层都不经该列）。
- **后续批次**：下一个涉及 `evidence` 表结构的 be-dev 批次一并处理（与 D-3 的 `stage` 写入方补齐同批，避免两次改表）。
- **前置条件**：确认 `nodes.evidence_note` 与 `flow_steps.file_path` 已长期承担「结论→代码」锚点职责（当前成立），并决定是否连带清理 `idx_evidence_stage`。
- **延期合理性**：SQLite 撤销 `ADD COLUMN` 需重建表，风险远高于留一个空列；本轮该表结构未再变动，单独为清理而重建属无业务价值的改动（Simplicity First）。
- **重新评估条件**：`evidence` 表因 D-2 / D-3 需要重建时；或出现按符号维度查询证据的真实需求时。
- Source：[[06-发布/REL-2026-10-28-p2-p5-closure|REL-2026-10-28-p2-p5-closure]]

---

## Closed（已闭环登记，历史不删除）

| ID | 主题 | 最终状态 | 关闭日期 | 验证证据 |
| --- | --- | --- | --- | --- |
| D-1 | symbols 版本列 + symbols↔evidence 直接连接键 | **已关闭**：版本列已具备（0002 + `persistSymbols` 按键覆盖写）；直接连接键按设计定型为**不需要**（符号是索引不是结论，证据锚点走 `flow_steps.file_path` 与 `nodes.evidence_note`） | 2026-10-28 | 失效传播端到端实测不依赖符号键（1 文件变更 → 3 证据 stale → 3 结论 flagged）；本轮复核 `graph/route.ts:58` 以 `file_path` 为连接维度。残留清理行为已转 **D-8** 单独登记，不影响本条关闭 |
