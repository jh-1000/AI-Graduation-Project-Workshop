---
project: proj-analysis-learner
type: requirement
parent: "[[scan]]"
status: active
---
# REQ — 静态扫描 Scan

## 用户故事
- US-1: 作为用户，我想在导入后立即看到文件清单、技术栈、路由与 API 端点，以便边等深度分析边学习。
- US-2: 作为用户，我想知道哪些文件被完整解析、哪些仅文本扫描，以便判断结果的可靠范围。

## 验收标准
- AC-1: Scan 完成后 files 表含解析方式标记（parsed/text_only/skipped）。
- AC-2: fixture#1 的已知路由与端点被正确抽取。
- AC-3: Scan 秒级完成，不调用任何 LLM。
