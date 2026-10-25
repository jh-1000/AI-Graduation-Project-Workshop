---
project: proj-analysis-learner
type: spec
parent: "[[tasks]]"
status: active
is_latest: true
---
# SPEC — 任务与恢复

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 状态机 | queued/running/paused/completed/failed/cancelled + 转换表 |
| F-2 | worker 子进程 | 心跳上报；杀进程树取消；启动恢复 |
| F-3 | 幂等 | 任务键=快照+配置+分析器版本+提示词版本+模型参数 |
| F-4 | 缓存键 | llm_cache=提示词全文+模型参数+输入哈希；与任务键分离 |
| F-5 | 预算 | 时间/令牌/并发/重试/输出上限；耗尽按优先级收尾 |

## 业务规则
- R-1: 暂存模型响应不是绝对保证——写缓存失败结果作废转 paused。
