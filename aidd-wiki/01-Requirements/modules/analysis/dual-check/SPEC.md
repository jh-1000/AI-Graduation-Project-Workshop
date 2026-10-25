---
project: proj-analysis-learner
type: spec
parent: "[[dual-check]]"
status: active
is_latest: true
---
# SPEC — 双重校验

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 支持性检查 | 证据是否直接支持结论 |
| F-2 | 反例与失败分支检查 | 是否遗漏反例、失败路径、调用链/异步/事务/外部系统影响 |
| F-3 | 范围检查 | 解释是否超出已核查范围 |
| F-4 | 冲突检查 | 相互冲突的证据触发 fact_conflicts 记录 |

## 业务规则
- R-1: 证据真实不代表解释正确；校验失败→flagged 或开放问题。
- R-2: 不得为页面完整而补造结论。

## 验收标准
- AC-1: 人为构造的过度推断样本被校验拦截为 flagged。

## 设计跟进
| 产物 | 链接 |
|------|------|
| DES | [[02-Design/modules/analysis/DES-analysis\|DES]] |
