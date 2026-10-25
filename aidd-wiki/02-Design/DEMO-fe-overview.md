---
project: proj-analysis-learner
type: design-demo
module: learning
area: tour
point: tour
title: DEMO-fe-overview
parent: "[[01-Requirements/modules/learning/tour/tour]]"
phase: design
status: review
date: 2026-10-25
---

# DEMO — 前端可交互 Demo 总览（跨模块）

> 交付物：`[[../../../output/fe-demo/index|fe-demo/index.html]]`（自包含单文件，双击即开，零依赖零网络——符合便携模式不变量）。
> 设计方法：frontend-design 技能双 pass（先 token 方案与自审，后实现）。

## 设计方案（Pass 1 定稿）

- **主题**：给 AI 辅助开发者的「项目 X 光机 + 答辩训练场」；页面唯一任务：让用户从"我想弄明白什么"走进一条真实业务流程，看懂、考自己、动手改。
- **色板**（工程蓝图 × 答题卡批改）：`--paper #F7F9FC` 图纸冷白 / `--ink #1B2A4A` 藏青墨线 / `--grid #DCE4F0` 图纸网格 / `--mark-red #C43D3D` 批改红（质疑·待复核） / `--pass-green #2E7D4F` 验证绿 / `--evidence-amber #B7791F` 证据琥珀
- **字体**：系统栈（便携无网络字体），个性由编号系统（EVIDENCE/OV-04/CH-02 档案编号）+ 图纸网格底纹 + 批改标记承担
- **签名元素**：地铁站点式业务流程线——五站四动作（看懂/看代码/追下去/考考我），"考考我"站点 3D 翻面出题
- **反俗套自审**：非米色+赤陶（是冷蓝图纸+批改红绿）、非暗底荧光、非报纸 hairline；网格线承载"工程测量"语义；状态徽标体系编码证据可信度（源码事实/推断/AI/用户/运行验证/待复核）——徽标即产品哲学

## 路由

| 路由 | 页面 | 对应需求 |
|------|------|---------|
| #/home | 零基础入口 + 项目列表 | [[tour/SPEC\|tour.SPEC]] |
| #/import | 新建分析 + **答辩任务书 MISSION**（三问锚定讲解与出题）+ 导入进度 | [[import/SPEC\|import.SPEC]] · [[overview]] |
| #/scan | **Scan 初步清单**：技术栈（lockfile 版本）/解析方式诚实口径/端点/路由 + 边分析边学习 | [[scan/SPEC\|scan.SPEC]] |
| #/code | **代码库阅读器（IDEA 式，只读）**：文件树+高亮+行号、证据行琥珀标记、符号大纲、调用关系（谁调用/它调用）、全局 codeJump 定位 | [[code-view/SPEC\|code-view.SPEC]] |
| #/overview | 总览：技术栈/六维覆盖/三状态/体检疑似/开放问题 | [[coverage/SPEC\|coverage.SPEC]] · [[audit/SPEC\|audit.SPEC]] |
| #/map | AI 分析现场：十阶段流水线/预算缓存/双重校验拦截/流式生成 | [[map-pipeline/SPEC\|map-pipeline.SPEC]] · [[dual-check/SPEC\|dual-check.SPEC]] |
| #/graph | **知识图谱**：2D/3D 力导向双视图、八类全量、单击侧卡+双击直达、类型过滤/搜索/掌握度外环 | [[model/SPEC\|model.SPEC]] · [[kb/SPEC\|kb.SPEC]] |
| #/flow | 业务流程线（签名元素）+ **反向追踪**（从数据写入点回到用户操作） | [[map-pipeline/SPEC\|map-pipeline.SPEC]] |
| #/kb | **知识库体系**：技术栈域×五类双视图、FSRS 复习队列、术语表、沉淀状态 | [[kb/SPEC\|kb.SPEC]] |
| #/node | 知识点页：十段渐进+三档+术语 chip+寓言卡+证据卡+沉淀条 | [[node-page/SPEC\|node-page.SPEC]] · [[terms/SPEC\|terms.SPEC]] |
| #/defend | 答辩模拟：一次一问+**阶梯提示**+双轴评分+**不看答案复述终局**+薄弱点 | [[grill/SPEC\|grill.SPEC]] |
| #/challenge | 挑战：定位/改码（**diff 视图**）/破坏实验+六查+**AI 协作双重闭环（脚手架三档）** | [[drill/SPEC\|drill.SPEC]] · [[ai-collab/SPEC\|ai-collab.SPEC]] |
| #/radar | 能力雷达：六维+三态+最近发展区+**答辩冲刺模式（14 天计划）** | [[practice/SPEC\|practice.SPEC]] |

## fe-demo 对照

| 文件 |
|------|
| `output/fe-demo/index.html`（单文件应用，hash 路由） |

## 交互流程要点

1. 首页入口卡 → 对应页面（用户不需要懂术语）
2. 流程线站点点击切换；四动作切换内容；"考考我"翻面出题，提示→最后才对答案
3. 术语 chip 弹层：人话/专业/示例/误区/Avoid 别名/项目用法 + "返回原位置"
4. 证据卡弹层：代码行号高亮 + 来源徽标 + **断言范围** + **尚未证明部分**
5. 答辩：回答→双轴独立评分（不合并）→评分依据引用预置要点与证据→薄弱点链回知识点
6. 挑战：三态分列（代码已修改/验证已执行/验收条件满足）+ 六查清单 + 一键还原
7. 寓言卡四段：故事→揭晓→映射表→回到项目 + "类比不成立之处"红色警示

## 数据

demo 全部内容来自 fixture#1（todo-clip）真实分析产物与预期证据，无占位假数据。

## 状态

| 状态 | UI |
|------|-----|
| loading | 按钮文案变化（导入中…） |
| empty | 项目空态引导："导入第一个项目，从看见它的文件清单开始" |
| error | 明确原因 + 如何修复（如路径不是目录） |
| stale 结论 | 红色"待复核"徽标 + 重新核查入口 |

## 关联

- [[01-Requirements/modules/learning/tour/tour|tour]]
- [[DES-learning]] · [[DES-defend]] · [[DES-challenge]]
- [[02-Design/standards/ui]]
- [[02-Design/standards/demo]]
