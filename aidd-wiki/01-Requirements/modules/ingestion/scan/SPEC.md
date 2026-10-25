---
project: proj-analysis-learner
type: spec
parent: "[[scan]]"
status: active
is_latest: true
---
# SPEC — 静态扫描 Scan

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 栈识别 | 识别 package.json/pom.xml/requirements.txt/go.mod 等，lockfile 取真实依赖版本 |
| F-2 | 路由抽取 | 正则+框架线索抽取前端路由表（React/Vue/Next 等） |
| F-3 | 端点抽取 | 抽取 Spring/Express/FastAPI/Flask 等常见注解端点 |
| F-4 | 数据模型线索 | 抽取 schema/模型定义线索 |
| F-5 | 解析方式标记 | 每文件标记 parsed/text_only/skipped |

## 业务规则
- R-1: Scan 不调用 LLM，零 token 成本。
- R-2: Scan 结果标注"初步清单"，不冒充完整分析。

## 验收标准
- AC-1: fixture#1 已知端点全部命中，无误报。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/ingestion/DES-ingestion\|DES]] |
