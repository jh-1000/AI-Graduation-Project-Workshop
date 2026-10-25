---
project: proj-analysis-learner
type: spec
parent: "[[security]]"
status: active
is_latest: true
---
# SPEC — 安全授权

## 能力清单
| ID | 能力 | 说明 |
|----|------|------|
| F-1 | 分层授权 | Auth-L0~L6 各含默认/授权/范围/复用/失效/撤销/记录 |
| F-2 | 出站过滤器 | 敏感文件排除+密钥遮蔽+发送清单确认+SSRF 防护 |
| F-3 | 文件安全 | realpath 授权/zip 消毒/炸弹防护/临时文件清理 |
| F-4 | 仓库不可信 | 定界符包裹+明示忽略指令+不执行项目脚本 |

## 业务规则
- R-1: 低风险不被阻塞；高风险不因低级授权默认获得。
