---
project: proj-analysis-learner
type: spec
parent: "[[invalidation]]"
status: active
is_latest: true
---
# SPEC — 失效传播

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 语义差异判定 | 重解析+AST 对比：等价→行号重映射保留；有差异→按节点定位传播；失败→保守失效 |
| F-2 | 版本绑定 | 六类版本（工作区/最近分析/学习/答辩/挑战基线/挑战结束），不一致 UI 显示差异 |
| F-3 | 传播链 | evidence→claims（多跳依赖）→flows/nodes→答辩题→挑战基线 |

## 业务规则
- R-1: 不以"注释无害"假设跳过判定，须解析器证明 AST 等价。
- R-2: 历史分析版本保留，不冒充当前事实。

## 验收标准
- AC-1: fixture 上修改一个文件，传播范围与预期清单一致。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/evidence/DES-evidence\|DES]] |
