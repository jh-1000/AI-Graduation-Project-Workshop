---
project: proj-analysis-learner
type: spec
parent: "[[repo-map]]"
status: active
is_latest: true
---
# SPEC — 上下文选料 PageRank

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 符号引用图 | web-tree-sitter 全库解析构建文件/符号引用图 |
| F-2 | PageRank 排序 | 个性化 PageRank 排序文件与符号重要性 |
| F-3 | 预算拟合 | 按 token 预算二分拟合选出代表文件集 |

## 业务规则
- R-1: 选料只决定 LLM 优先级与上下文预算，不决定覆盖统计口径。
- R-2: TS/JS 深度语义以 ts-morph 为准，tree-sitter 结果仅作补充。

## 验收标准
- AC-1: fixture#1 已知核心文件入选；未选文件在覆盖报告中如实标注。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/analysis/DES-analysis\|DES]] |
