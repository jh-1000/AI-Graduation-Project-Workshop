---
project: proj-analysis-learner
type: slot
slot_kind: invariant
title: project-invariants
pinned: true
is_latest: true
status: active
date: 2026-10-25
---

# Project invariants

> 跨阶段必守约束。`/aidd` Brief、spec/design/fe-dev/be-dev 执行前注入本页要点（≤15 行）。

## Must

- 最终形态必须支持**便携模式**（最终目标）：全部状态（数据库/上传工作区/导出物）只存于应用目录相对路径 `data/` 下；不依赖注册表、固定安装路径或系统全局配置；随目录拷贝即可迁移（zip 导入的项目完全便携；路径导入的项目记录的是机器本地路径，属已知机器绑定项，UI 需标注）。
- 每条分析结论必须携带证据与 `analysis_version`；未经运行验证是正常状态，验证徽标必须注明断言范围。
- 可信度七不等式贯穿 UI 文案；三个总状态（任务完成/覆盖充分/结论已验证）独立展示。

## Must not

- 不得把任何绝对路径写死进代码或数据库 schema（工作区、数据目录一律相对应用根）。
- 不得执行被分析项目内的脚本；出站 LLM 请求必须先过出站过滤器（敏感文件排除+密钥遮蔽+SSRF 校验）。
- 不得把"代表性文件分析完成"表述为"整库分析完成"。

## Links

- [[../overview]]
