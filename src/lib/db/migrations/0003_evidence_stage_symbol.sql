-- 0003: P2 数据底座（解 Decision-Register D-1 / D-3）
-- D-1: symbols 与 evidence 之间补连接键——evidence.symbol_id 指向产生该证据的符号。
--       之前符号只能按 file_id 定位文件，无法回指"这条证据对应哪个符号"。
-- D-3: evidence 加 stage 列，区分写入阶段（不再靠 note 前缀 endpoint:/route: 判定）。
-- D-2: 不解决——Decision-Register 明确"唯一约束一旦加上会锁死历史版本保留方案"，
--       当前 delete-then-insert 幂等足够，版本生命周期留给后续按 analysis_version 过滤读取。

-- D-1：证据可回指符号（可空——文件级证据如路由声明不绑符号）
ALTER TABLE evidence ADD COLUMN symbol_id INTEGER REFERENCES symbols(id);

-- D-3：写入阶段标记（static=静态扫描端点/路由；flow=业务流程追踪；llm=模型产物；manual=人工录入）
ALTER TABLE evidence ADD COLUMN stage TEXT NOT NULL DEFAULT 'static';

-- 按阶段+版本查询的索引（未来失效传播按 stage 圈定重算范围）
CREATE INDEX IF NOT EXISTS idx_evidence_stage ON evidence(project_id, analysis_version, stage);
