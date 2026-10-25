---
project: proj-analysis-learner
type: spec
parent: "[[grill]]"
status: active
is_latest: true
---
# SPEC — 答辩演练

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | grill 协议 | 一次一问；能从代码验证的先查代码再评判 |
| F-2 | 双轴评分 | 轴 A 代码事实自洽 / 轴 B 兑现声称，独立呈现 |
| F-3 | AI 题型库 | 为什么这样实现/关键判断/验证 AI 没遗漏/发现错方案/影响面/不用 AI 定位 |
| F-4 | 题源 | 知识点+体检追问点（疑似标注）+任务书 |
| F-5 | 薄弱点报告 | 链回知识点与代码证据 |
| F-6 | 语音作答 | 三层复用现成开源方案：①浏览器原生 Web Speech API（react-speech-recognition，localhost 免费实时转写）②浏览器离线 Whisper（whisper.wasm/@remotion/whisper-web，贴合便携）③云端转写 API 保底；转写进答题框可编辑后提交；不支持的浏览器降级打字 |

## 业务规则
- R-1: 评分必须引用预置评分要点和项目证据。
- R-2: 题目绑定项目版本，过期证据不得静默引用。
