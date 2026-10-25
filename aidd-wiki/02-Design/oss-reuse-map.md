---
project: proj-analysis-learner
type: design
phase: design
status: active
is_latest: true
date: 2026-10-25
---

# OSS 复用地图（不重复造轮子审计）

> 原则：demo 的自研实现只服务于"单文件可检查"；正式版一律按下表替换为成熟库。新增依赖前先查本表。
> 验证记录：AI SDK openai-compatible 实测支持 GLM/DeepSeek/Ollama（generateObject+zod）；sqlite-vec 官方 npm 可直接 load 进 better-sqlite3。

## A. 已复用（维持）

| 功能 | 库 |
|------|-----|
| 代码高亮 | Shiki |
| zip 导入 | adm-zip + Node TextDecoder(gbk) |
| 复习调度 | ts-fsrs（FSRS-7） |
| 语音作答 | react-speech-recognition / whisper.wasm / @remotion/whisper-web |
| 结构化校验 | zod |
| 备份 | better-sqlite3 db.backup()（内置 Online Backup） |
| 中文检索基座 | SQLite FTS5（内置） |
| 语法/符号 | ts-morph + web-tree-sitter + tree-sitter-wasms |

## B. 🔄 正式版替换自研 → 成熟库

| 功能 | 现状 | 替换为 | 理由 |
|------|------|--------|------|
| LLM 客户端 | 自研 client.ts（缓存/重试/zod） | **Vercel AI SDK**：`ai` + `@ai-sdk/openai-compatible` | generateObject 原生结构化输出（自动降级 JSON/tool 策略）、流式、GLM/DeepSeek/Ollama 同一接口；**自研出站过滤器（SSRF/密钥遮蔽）保留，套在 provider fetch 之外——这是安全差异化，不复用** |
| 代码阅读器 | demo 自研行渲染 | **CodeMirror 6（只读）** | gutter 证据标记、大文件虚拟滚动、搜索面板、代码折叠全内置 |
| 改码 diff | demo 静态展示 | **@codemirror/merge**（或 diff2html）+ **jsdiff** 计算与应用 | 内置统一 diff 视图 |
| 文件树 | demo 自研 | **react-arborist** | 虚拟化树，大仓库不卡 |
| PageRank/图算法 | 计划自研数学 | **graphology + graphology-metrics**（pagerank 现成） | repo-map 只写"建图+调用"，不写算法 |
| 雷达/统计图 | demo 手绘 SVG | **ECharts**（按需 RadarChart） | 正式版交互/动画白拿 |
| FTS5 中文分词增强 | 默认 unicode61 按字切分 | **wangfenjin/simple** tokenizer（可选，P2） | 分词+拼音检索更好；默认已可用故标可选 |
| LLM 并发控制 | 计划自研计数 | **p-limit / p-queue** | worker 批量调用的并发/队列现成 |

## C. ➕ 新增复用（P3 检索第二步）

| 功能 | 方案 | 说明 |
|------|------|------|
| 知识条目语义索引 | **sqlite-vec**（`sqliteVec.load(db)` 挂进现有 better-sqlite3；或 @dao-xyz/sqlite3-vec 自带预编译）+ **transformers.js** 本地 embedding（bge-small-zh-v1.5，离线便携） | 向量存储就放同一个 SQLite 文件，零新增服务；embedding 免费离线 |

## D. 🚫 明确不引入（过度工程警戒线）

- LangChain / LlamaIndex（编排流程简单，自研足够）
- 独立向量数据库（Qdrant/Milvus——sqlite-vec 足够）
- Redis / BullMQ（SQLite 任务表已覆盖）
- Electron / Tauri（便携 = portable node + 启动脚本；Tauri 留作远期可选）
- Monaco 全功能编辑器（只读阅读器 CodeMirror read-only 足够；编辑只在挑战隔离区）
- 逆向第三方客户端积分接口（合规 + 稳定性）

## E. demo 保留自研的（仅演示形态）

canvas 3D 力导向 / 站点式流程线 / 手绘雷达 / 自研代码行渲染——正式版按 B 表替换，demo 不动。

## 关联

- [[DES-learning]] · [[DES-ingestion]] · [[DES-analysis]] · [[DES-platform]]
- [[overview]]
