---
project: proj-analysis-learner
type: spec
parent: "[[storage]]"
status: active
is_latest: true
---
# SPEC — 存储与并发

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | WAL 并发 | 短事务+busy_timeout+指数退避；不做跨进程写协调者 |
| F-2 | 版本化迁移 | meta.schema_version；事务化迁移 |
| F-3 | 在线备份 | db.backup 定时+手动；恢复校验；磁盘预检 |
| F-4 | 数据分离 | 分析数据与学习记录分离；稳定 key 保留 mastery |
| F-5 | 缓存与花费统计 | llm_cache 命中率、token 花费按阶段聚合展示（AI 现场与设置页）；提供清空缓存入口——仅删 llm_cache，**不影响学习记录与分析产物**（nodes/claims/寓意卡等已落库实体） |

## 业务规则
- R-1: 不承诺关闭时自动备份（强杀无法执行钩子）。
- R-2: 清缓存零 token 损失——已生成知识点是持久实体，缓存仅加速重复生成。
