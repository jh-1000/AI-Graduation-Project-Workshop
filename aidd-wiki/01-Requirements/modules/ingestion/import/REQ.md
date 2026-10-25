---
project: proj-analysis-learner
type: requirement
parent: "[[import]]"
status: active
---
# REQ — 项目导入

## 用户故事
- US-1: 作为用户，我想通过本地路径或 zip 包导入我的项目，以便系统开始分析。
- US-2: 作为用户，我想看到导入进度与失败清单，以便知道哪些文件没被读取以及为什么。

## 验收标准
- AC-1: 给定一个有效本地目录，导入后文件清单与磁盘实际一致（忽略 node_modules/.git/dist 等噪音目录）。
- AC-2: 给定一个含中文文件名的 zip，导入后文件名正确无乱码。
- AC-3: 路径穿越、符号链接逃逸、zip 炸弹被拒绝且给出明确原因。
