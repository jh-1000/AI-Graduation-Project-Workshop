---
project: proj-analysis-learner
type: requirement
parent: "[[storage]]"
status: active
---
# REQ — 存储与并发

## 用户故事
- US-1: 作为用户，app 与 worker 同时写库不丢数据、不死锁；我的学习记录不因重跑分析被清掉。

## 验收标准
- AC-1: 并发压测（2 分析任务+UI 写操作 10 分钟）0 丢失、无永久 BUSY、两项 check 干净。
- AC-2: 在线备份（db.backup）在写压下产出一致快照，恢复校验通过。
- AC-3: 迁移失败进入维护模式不自动重试。
