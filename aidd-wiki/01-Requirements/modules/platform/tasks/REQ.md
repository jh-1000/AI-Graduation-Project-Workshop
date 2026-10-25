---
project: proj-analysis-learner
type: requirement
parent: "[[tasks]]"
status: active
---
# REQ — 任务与恢复

## 用户故事
- US-1: 作为用户，我的分析任务在关闭浏览器、worker 崩溃、服务重启后都能恢复到明确位置。
- US-2: 作为用户，重复提交不产生重复任务；取消不留残留进程。

## 验收标准
- AC-1: 六状态状态机+转换表生效；心跳超时自动重排，恢复计数>3 转 failed。
- AC-2: 任务幂等键与 llm_cache 键分离生效。
- AC-3: 12 类故障对策逐一演练通过。
