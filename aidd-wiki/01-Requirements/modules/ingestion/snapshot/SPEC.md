---
project: proj-analysis-learner
type: spec
parent: "[[snapshot]]"
status: active
is_latest: true
---
# SPEC — 输入快照

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 快照生成 | run_files 表记录 path/size/mtime/sha256，不复制源码内容 |
| F-2 | 阶段核对 | 每阶段读取前重算哈希比对快照 |
| F-3 | 变化处理 | 单文件变化→跳过+开放问题；超阈值→run 转 stale |

## 业务规则
- R-1: 符号、引用、证据行号与分析结论必须来自同一已核对版本。
- R-2: 不以"注释无害"为由跳过核对，须解析器证明语义等价。

## 验收标准
- AC-1: 修改 fixture 文件后重跑，未受影响结论不失效、受影响结论按传播规则标记。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/ingestion/DES-ingestion\|DES]] |
