---
project: proj-analysis-learner
type: dev-task
parent: "[[01-Requirements/modules/learning/learning|learning]]"
date: 2026-10-29
status: done
phase: fe-dev
batch: 10-29 学习升级 + 追问链
---

# FE-learning-upgrades · 追问链 + 6 项学习升级（含 3 个新 API 与 DDL 0007）

## 目标

在已完成的学习闭环 / 答辩演练之上做一次增量深化：让学习者从「看讲解」走到「动手探」——对代码位置发起真实影响实验、对比替代写法、按技术栈路径系统补课，并在答辩演练中加入多层追问。全程复用既有基建（challenge 工作区、chatJSON、FSRS），不引入新依赖。

## 范围（Known Impact）

| 文件 / 落点 | 动作 | 影响 |
| --- | --- | --- |
| `src/app/api/projects/[id]/defend/route.ts` | 改 | 新增 `action=followup`：基于回答缺口 + 证据生成下一层追问 |
| `src/app/api/projects/[id]/probe/route.ts` | 新建 | 交互式影响探针：注释目标行 → 变异副本验证 → 前后 diff + insight |
| `src/app/api/projects/[id]/alternatives/route.ts` | 新建 | 换一种写法对比器：LLM 生成 2–3 种替代实现 + tradeoff |
| `src/app/api/projects/[id]/techpath/route.ts` | 新建 | 技术栈学习路径只读端点（按最新版本返回概念链） |
| `src/lib/db/migrations/0007_tech_path.sql` | 新建 | `tech_paths` / `tech_path_items` 两表 |
| `src/app/project/[id]/kb/page.tsx` | 重写 | KB 页曾被意外覆盖为雷达页，完整恢复：三视图 / 复习队列 / 术语弹层 / 混淆对比卡，并新增 techpath 视图、复习卡加代码位置提示 + 证据锚点 |
| `src/app/project/[id]/radar/page.tsx` | 新建 | 技术栈雷达页（按依赖维度） |
| `src/app/project/[id]/node/page.tsx` | 改 | 知识点页接入影响探针与替代写法对比器入口 |

## 关键设计

1. **影响探针复用 challenge 的「隔离实验」哲学但不复用其代码路径**：probe 把目标行注释后写入 `data/probe/probe-<ts>/` 临时副本（`finally` 兜底清理），原文件只读不写；可选 `verifyCommand` 在项目根真实验证（需 `allow_modify` 且项目有 `node_modules`），验证失败本身就是教学结果（"这就是这行代码存在的意义"）。
2. **alternatives 走 chatJSON + zod**（`AltSchema`：2–3 项，`name/code/pros/cons/chosen` + `insight`），prompt 显式给出精确英文键 JSON 形状——延续 D-6 约定；`realpathSync` 越界防护（403）、片段截断 6000 字符、无 Key 显式 400 而非静默降级。
3. **techpath 是纯只读端点**：取 `tech_paths` 最新 `analysis_version` 返回概念链（`seq/concept_title/project_ref/prereq_item_id`），无数据返回空结构不报错；数据由 map 链按版本写入，`UNIQUE(project_id, analysis_version, tech_name)` 保证幂等。
4. **追问链有深度上限**（表层→原理→边界，最多 3 层），每层追问独立评分，防止无限追问烧 token；生成依据是上一轮回答的缺口 + 关联证据，不是固定题库。
5. **KB 页修复属数据事故恢复**：重写时以既有功能清单（三视图/复习队列/术语弹层/混淆对比卡）为验收基准逐项恢复，再叠加 techpath 视图与复习卡增强。

## 执行记录 / 验证

- 阶段自述：E2E 27/27（未由后续轮次独立复核，见 [[06-发布/REL-2026-10-29-learning-upgrades|REL-2026-10-29]]）。
- **测试缺口（如实记录）**：probe / alternatives / techpath / followup 四个新接口无 e2e 用例——probe 依赖 `allow_modify` 与可变项目、alternatives 与 followup 依赖 LLM Key，均在 S6（LLM 有数据路径）同一阻塞类。
- DDL 0007 未入库（与 0003–0006 同状态，见 REL-2026-10-28 § DDL）。
