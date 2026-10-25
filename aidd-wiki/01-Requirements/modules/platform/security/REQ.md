---
project: proj-analysis-learner
type: requirement
parent: "[[security]]"
status: active
---
# REQ — 安全授权

## 用户故事
- US-1: 作为用户，我要求文件读取、模型调用、命令执行、代码修改各有明确权限边界。
- US-2: 作为用户，我不希望项目里的恶意指令改变系统行为，也不希望密钥泄漏。

## 验收标准
- AC-1: Auth-L0~L6 生效；L1a（使用模型）与 L1b（发送内容）分离授权。
- AC-2: 出站过滤器拦截敏感文件并遮蔽密钥；SSRF 三场景全拒、本地模型授权放行。
- AC-3: 仓库文本视为数据不执行；密钥不进日志/缓存/导出。
