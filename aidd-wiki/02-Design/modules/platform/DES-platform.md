---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 平台底座 `platform`

## 架构要点
- 任务状态机（6 状态+转换表）：`src/lib/tasks.ts`；worker 由 API route 以 child_process.spawn 派生，心跳写 analysis_runs，启动恢复流程重排心跳超时任务（恢复计数>3→failed）
- 键分离：任务幂等键=hash(快照 ID+配置+分析器版本+提示词版本+模型参数)；llm_cache 键=hash(提示词全文+模型参数+输入哈希)
- SQLite：WAL+busy_timeout(5000)+短事务+BUSY 指数退避≤5；app 写用户表、worker 写分析表，均短事务；迁移事务化+meta.schema_version
- 备份：db.backup() 定时+手动；恢复校验 integrity_check+行数比对；磁盘预检
- 安全：Auth-L0~L6 矩阵；llm-client 出站过滤器（敏感文件排除/密钥遮蔽/SSRF 校验含 DNS IP 检查与逐跳重定向/本地模型显式放行）；文件 realpath 授权与 zip 消毒

## 数据与状态
- analysis_runs/llm_cache/settings（密钥只写不读）/grill_sessions 等

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[tasks/SPEC\|SPEC]] | tasks.ts + worker 入口 scripts/worker.ts |
| [[storage/SPEC\|SPEC]] | db.ts + migrations/ + backup.ts |
| [[security/SPEC\|SPEC]] | authz.ts + outbound-filter.ts + ingest 安全校验 |

## 关联
- [[02-Design/Design-Graph]]
