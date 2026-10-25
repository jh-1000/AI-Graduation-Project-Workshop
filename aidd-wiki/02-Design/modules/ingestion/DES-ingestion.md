---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
---
# DES — 导入与扫描 `ingestion`

## 架构要点
- 导入器：`src/lib/ingest.ts`——路径导入（fs.realpathSync 授权根目录前缀校验）与 zip 导入（条目消毒/总量与条目数上限/编码探测 iconv-lite）
- 噪音过滤：默认排除 node_modules/.git/dist/build/.next 等；权限错误入跳过清单
- Scan：`src/lib/scan.ts`——零 LLM；栈识别（package.json/pom.xml/requirements.txt/go.mod + lockfile）；路由与端点正则抽取（Spring/Express/FastAPI/Flask/Next）；每文件标记 parsed/text_only/skipped

## 数据与状态
- 写 `projects`/`files`/`run_files`（快照：path/size/mtime/sha256）
- Scan 完成即生成输入快照；后续阶段核对以快照为真源

## 接口意图（→ API 设计阶段细化）
- POST /api/projects（导入）、GET /api/projects、GET /api/projects/[id]/scan

## 需求↔设计
| 需求 L3 | 设计落点 |
|---------|---------|
| [[import/SPEC\|SPEC]] | ingest.ts realpath/zip 消毒；AC 用 fixture 校验 |
| [[scan/SPEC\|SPEC]] | scan.ts 正则抽取器集合；files 解析方式标记 |
| [[snapshot/SPEC\|SPEC]] | run_files 表 + 阶段前哈希核对（>5% 转 stale） |

## 关联
- [[02-Design/Design-Graph]]
