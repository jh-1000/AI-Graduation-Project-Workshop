---
project: proj-analysis-learner
type: pending-index
status: active
date: 2026-10-25
---

# Pending writes

多产物（≥3 个目标路径）或用户说 **暂存** 时，先写入：

```text
_pending/<phase>-<topic>-YYYYMMDD/
  MANIFEST.md    # 目标路径对照表
  …草稿文件…
```

用户回复 **入库** 后，按 MANIFEST 晋升到真源目录，再追加 `log.md`，并删除或清空该 pending 目录（仅删 pending，不删真源）。

单文件常规入库可直写真源，不必经 pending。
