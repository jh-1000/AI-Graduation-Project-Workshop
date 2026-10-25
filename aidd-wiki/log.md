# AIDD Wiki Log

## [2026-10-25 09:59:01] init | create | aidd-wiki created

## [2026-10-25 09:59:25] init | update | overview 已完善：软件项目分析学习系统

## [2026-10-25 10:05:00] spec | create | 新增 8 模块 17 功能点 REQ/SPEC 与 Requirements-Graph/module-index

## [2026-10-25 10:07:24] design | create | 8 模块 DES 与 Design-Graph 双链初始化

## [2026-10-25 10:42:30] be-dev | create | P0 骨架完成：脚手架/DB迁移/llm-client出站过滤/导入Scan/worker断点续跑/fixture回归；T1-T6 与 C1-C5 验证通过（T3/C4 待 API Key）

## [2026-10-25 10:47:14] design | create | 前端可交互 demo 完成（frontend-design 双 pass：工程蓝图×答题卡批改；签名元素=站点式流程线），待用户检查

## [2026-10-25 10:58:51] spec | create | 新增 learning/kb 知识库体系 REQ/SPEC（用户反馈：知识点需沉淀为按技术栈组织的持久知识库）

## [2026-10-25 10:59:01] spec | create | 新增 learning/kb 知识库体系 REQ/SPEC（用户反馈：知识点需沉淀为按技术栈组织的持久知识库）

## [2026-10-25 11:02:13] design | update | demo 新增知识库体系屏（技术栈域×五类双视图/FSRS 复习队列/术语表/沉淀条），回应知识点持久化反馈

## [2026-10-25 11:07:03] design | update | demo 布局修复：主内容区加宽至 1200px 并居中，宽屏不再左挤

## [2026-10-25 11:09:11] design | update | demo 补充设置与授权屏（ST-01~04：模型服务/Auth 分层授权/出站过滤器/便携模式）

## [2026-10-25 11:14:14] design | update | demo 强化 AI 在场感：新增 AI 分析现场屏（十阶段流水线/预算缓存/双重校验拦截/流式生成），讲解寓言卡标注 AI 生成与 token 成本，评委与全局助手标注证据绑定

## [2026-10-25 11:30:14] design | update | demo 新增知识图谱屏（grill-me 协议敲定：2D+3D 双视图自研 canvas 力导向、八类全量、单击侧卡+双击直达、类型过滤/搜索/掌握度外环）

## [2026-10-25 11:35:45] design | update | 图谱交互修复：画布分辨率 1:1 消除命中偏移、6px 拖拽死区、自动旋转默认关（工具栏开关+悬停暂停）

## [2026-10-25 11:39:49] design | update | 修复 3D 成平面：2D→3D 切换时按 z 方差重注入深度 + 3D 深度雾化（远淡近实）

## [2026-10-25 11:49:51] design | update | demo 补齐 8 项缺口：导入+任务书/Scan 清单/AI 协作双闭环三档/diff 视图/答辩完整闭环（阶梯提示+复述终局）/冲刺模式/混淆对比卡/反向追踪

## [2026-10-25 11:52:31] design | update | 图谱所有节点常显标签（小节点小一号字+白描边），消除无名节点

## [2026-10-25 11:59:52] spec | create | 新增 ingestion/code-view 代码库阅读器 REQ/SPEC（grill-me 敲定：只读形态+三层联动）

## [2026-10-25 12:02:55] design | create | demo 新增代码库阅读器屏（grill-me 敲定：只读+三层联动；证据行标记/符号大纲/调用关系/全局 codeJump 跳转）

## [2026-10-25 12:07:11] design | update | 空间利用改造（grill-me 敲定）：全站加宽 1680px、代码/图谱高度自适应视口、专注模式开关（隐藏侧栏+退出浮钮）、修代码正文颜色 bug

## [2026-10-25 12:09:02] design | update | 修复调用关系卡窄栏排版：改为路径/说明上下堆叠，长路径自动断行

## [2026-10-25 12:13:51] design | update | 跳转反馈修复：落点行脉冲高亮+顶栏行号常显+来源提示条（调用关系/流程线/证据卡全部带跳转来源）

## [2026-10-25 12:17:54] design | update | 修复弹层不随导航关闭：go() 统一收起弹层+同 hash 强制重渲染+Esc 关闭；证据卡按钮改为真实跳转流程线对应站点

## [2026-10-25 12:26:56] design | update | 设置页新增服务商预设（免费额度优先/付费 API 保底）：demo 与真实骨架同步；策略声明：仅官方开放接口，不做客户端积分逆向

## [2026-10-25 12:33:59] design | update | 检索决策（grill-me 敲定）：轻量混合检索两步走——P1/P2 FTS5 词法+图谱双链邻域+结构化过滤（零新依赖）；P3 可选知识条目级语义索引（免费源/Ollama）；源码全文 RAG 维持非目标。tour/ai-collab SPEC 与 DES-learning 已同步

## [2026-10-25 12:37:31] design | update | 答辩屏改双栏布局（左对话流弹性/右薄弱点+知识链接+任务书锚点），标题问数改动态，修复 720px 遗留限宽贴左

## [2026-10-25 12:44:22] design | create | 答辩语音作答（grill-me 敲定：三层复用开源——react-speech-recognition 原生实时转写 / whisper.wasm 离线层 / 云端保底）；demo 实装原生识别+file:// 模拟转写降级

## [2026-10-25 12:47:50] design | create | OSS 复用地图审计（用户要求查重）：8 处正式版替换（AI SDK/CodeMirror 6/graphology/sqlite-vec 等）、6 处不引入警戒线；验证 AI SDK GLM 支持与 sqlite-vec×better-sqlite3

## [2026-10-25 12:57:38] spec | update | platform/storage SPEC 增补 F-5 缓存与花费统计（用户确认加入待办，P2 实施）

## [2026-10-25 19:26:20] be-dev | create | 证据写入链路落地（BE-evidence）：新增 src/lib/evidence.ts，worker 改三阶段 scan/symbols/evidence 并改条件抢占，regression/c-loop/t6-zip cleanup 重排与落库断言；同时新建 Decision-Register.md 登记 D-1/D-2/D-3/U-1

## [2026-10-25 20:52:05] fe-dev | create | P1 最小闭环落地（FE-p1-loop）：0002_map_learning.sql 建 6 张表并给 symbols 补 analysis_version；新增 flows.ts 确定性业务流追踪、llm/analyze.ts（三 zod schema + 无 Key 降级写 open_questions）、client.ts 接入出站过滤器；worker 改双链 SCAN/MAP；新增 5 个只读端点与项目页证据卡/业务流/节点/术语/练习五区块；regression 增 flows 与符号版本断言；D-1 前半标记部分解决

## [2026-10-25 21:29:51] fe-dev | update | 构建阻塞解除并完成浏览器实机走查：typescript 7.0.2 → 6.0.3（package.json + lockfile），next build / next dev 均通过；analyze/route.ts 的 require.resolve("tsx/cli") 改为 resolveTsxCli() 按路径解析，避免 webpack 打包 esbuild 的 .d.ts；实机走查 /project/35 跑通 map-v1 并渲染证据卡/业务流程/节点/术语/练习五区块；修掉不存在项目时整页 Application error（load() 未检查 res.ok）
