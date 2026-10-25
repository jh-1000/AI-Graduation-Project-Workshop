---
project: proj-analysis-learner
type: spec
parent: "[[import]]"
status: active
is_latest: true
---
# SPEC — 项目导入

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 路径导入 | 用户填写本地绝对路径，realpath 校验限定授权根目录 |
| F-2 | zip 导入 | 解压到 data/ 下工作区，设总大小/条目数/单文件上限 |
| F-3 | 噪音过滤 | 默认排除 node_modules/.git/dist/build/.next 等 |
| F-4 | 失败清单 | 权限错误/超限文件记入跳过清单，含原因 |
| F-5 | 中文编码 | zip 条目名 cp437/gbk 探测转 UTF-8 |

## 业务规则
- R-1: 任何文件读取不得突破授权根目录（realpath 前缀匹配）。
- R-2: zip 条目路径含绝对路径或 `..` 时拒绝该条目并记录。

## 验收标准
- AC-1: fixture 项目导入后 files 表行数与预期清单一致。
- AC-2: 构造含 `../` 条目的 zip，导入被拒且日志可查。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/ingestion/DES-ingestion\|DES]] |
