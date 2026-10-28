"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

type Settings = {
  baseUrl: string;
  model: string;
  temperature: number;
  allowLocalModel: boolean;
  maxContextChars: number;
  budgetTokens: number;
  apiKeyMasked: string | null;
};

type Stats = {
  calls: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  cacheEntries: number;
  budget: number;
  model: string;
};

const PRESETS = [
  { name: "智谱 GLM（含免费 glm-4-flash）", base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash", local: false },
  { name: "DeepSeek", base: "https://api.deepseek.com", model: "deepseek-chat", local: false },
  { name: "硅基流动（含免费小模型）", base: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct", local: false },
  { name: "本地 Ollama（免费 · 离线）", base: "http://127.0.0.1:11434/v1", model: "qwen2.5:7b", local: true },
];

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cleared, setCleared] = useState<string | null>(null);

  const loadStats = () =>
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then(setS);
    void loadStats();
  }, []);

  async function save() {
    if (!s) return;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: s.baseUrl,
        model: s.model,
        temperature: s.temperature,
        allowLocalModel: s.allowLocalModel,
        maxContextChars: s.maxContextChars,
        budgetTokens: s.budgetTokens ?? 0,
        apiKey: apiKey || undefined,
      }),
    });
    setSaved(true);
    setApiKey("");
    const fresh = await fetch("/api/settings").then((r) => r.json());
    setS(fresh);
    void loadStats();
    setTimeout(() => setSaved(false), 2000);
  }

  const body = !s ? (
    <p className="mut" style={{ padding: 40 }}>加载中…</p>
  ) : (
    <div>
      <div className="crumb">SETTINGS / 模型服务 · 授权 · 安全 · 便携</div>
      <h1 className="t">设置与授权</h1>
      <p className="sub">
        密钥<b>只写不读</b>：页面上永远只显示掩码。策略：<b>免费额度优先（服务商预设），付费 API 保底</b>；
        仅接入官方开放接口——客户端签到积分走私有协议，不做逆向适配。
      </p>

      <div className="grid2" style={{ marginTop: 18, gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <div className="hd">
            <span className="file-no">ST-01</span><b>模型服务</b>
            <span className="right">
              {s.apiKeyMasked ? <span className="badge b-run">已配置 · {s.apiKeyMasked}</span> : <span className="badge b-stale">未配置 Key</span>}
            </span>
          </div>
          <div className="bd">
            <div className="field">
              <label>服务商预设（点选自动填充）</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    className="chip"
                    type="button"
                    onClick={() => {
                      setS((prev) => prev && { ...prev, baseUrl: p.base, model: p.model, ...(p.local ? { allowLocalModel: true } : {}) });
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>baseURL</label>
                <input type="text" value={s.baseUrl} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} />
              </div>
              <div className="field">
                <label>模型名</label>
                <input type="text" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>API Key {s.apiKeyMasked && <span className="mut">（当前：{s.apiKeyMasked}）</span>}</label>
              <input type="password" placeholder="输入新 Key 以更新；留空保持不变" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, lineHeight: 1.7, padding: "10px 12px", border: "1px solid var(--grid)", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
              <input type="checkbox" style={{ marginTop: 3 }} checked={s.allowLocalModel} onChange={(e) => setS({ ...s, allowLocalModel: e.target.checked })} />
              <span>
                <b style={{ display: "block", fontSize: 13 }}>允许本地/内网模型服务</b>
                如 Ollama（127.0.0.1）。明确授权后才放行私网地址，避免 SSRF。
              </span>
            </label>
            <div className="toolrow" style={{ marginBottom: 0 }}>
              <button className="btn" type="button" onClick={save}>{saved ? "已保存 ✓" : "保存设置"}</button>
              {saved && <span style={{ color: "var(--pass-green)", fontSize: 12 }}>保存成功</span>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="hd"><span className="file-no">ST-02</span><b>分层授权（Auth-L0~L6）</b><span className="right badge b-infer">逐项独立，互不继承</span></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            <div className="st"><span><b>L0</b> 只读扫描与静态分析</span><span className="badge b-green">已生效</span></div>
            <div className="st"><span><b>L1a</b> 使用模型服务</span><span className={s.apiKeyMasked ? "badge b-green" : "badge b-stale"}>{s.apiKeyMasked ? "已授权" : "未配置"}</span></div>
            <div className="st"><span><b>L1b</b> 发送项目内容</span><span className="badge b-infer">出站过滤器</span></div>
            <div className="st"><span><b>L2</b> 执行构建/测试命令</span><span className="badge b-none">P2 接入</span></div>
            <div className="st"><span><b>L3/L4</b> 外网/真实数据</span><span className="badge b-none">默认拒绝</span></div>
            <div className="st"><span><b>L5</b> 修改项目文件</span><span className="badge b-none">P4 接入</span></div>
            <div className="st"><span><b>L6</b> 提交/推送/部署</span><span className="badge b-none">不提供</span></div>
            <div className="mut" style={{ fontSize: 11, marginTop: 4 }}>
              低风险不被阻塞；高风险不因曾授权低级而默认获得。
            </div>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="hd"><span className="file-no">ST-03</span><b>出站过滤器（发送前强制执行）</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.05 }}>
            <div className="mono" style={{ fontSize: 12 }}>
              默认排除：<s style={{ color: "var(--mark-red)" }}>.env*</s>　<s style={{ color: "var(--mark-red)" }}>*.pem / *.key</s>　<s style={{ color: "var(--mark-red)" }}>id_rsa*</s>　<s style={{ color: "var(--mark-red)" }}>credentials*</s>
            </div>
            <div>内容级密钥检测：sk-… / AKIA… / ghp_… / JWT / 私钥块 → 命中遮蔽为 <code>[REDACTED]</code></div>
            <div>目标校验：DNS 解析后拒绝私网/环回；重定向逐跳重校验（禁自动跟随）</div>
            <div className="mut" style={{ fontSize: 11, marginTop: 4 }}>
              密钥不进日志、错误栈、缓存键、导出文件或提示词。
            </div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">ST-04</span><b>便携模式</b><span className="right badge b-run">最终目标 · 已按此设计</span></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
            <div>数据目录：<code>./data</code>（相对应用根）——数据库、工作区、备份、导出全在这里</div>
            <div>✓ 随目录拷贝即可迁移，不依赖注册表与安装路径</div>
            <div>✓ zip 导入的项目完全便携；路径导入的项目绑定本机（UI 已标注）</div>
            <div>✓ 界面不加载任何网络字体 / CDN 资源</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">ST-05</span><b>缓存与花费统计</b>
          <span className="right"><span className="mut" style={{ fontSize: 11 }}>计量来自真实调用响应 usage</span></span>
        </div>
        <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
          {!stats ? <span className="mut">加载中…</span> : (
            <>
              <div className="grid3" style={{ gap: 10 }}>
                <div className="st"><span>模型调用</span><span><b>{stats.calls}</b> 次</span></div>
                <div className="st"><span>缓存命中率</span><span><b>{Math.round(stats.hitRate * 100)}%</b>（{stats.cacheHits}/{stats.cacheHits + stats.cacheMisses}）</span></div>
                <div className="st"><span>缓存条目</span><span>{stats.cacheEntries}</span></div>
                <div className="st"><span>输入 tokens</span><span>{stats.tokensPrompt.toLocaleString()}</span></div>
                <div className="st"><span>输出 tokens</span><span>{stats.tokensCompletion.toLocaleString()}</span></div>
                <div className="st"><span>合计 tokens</span><span><b>{stats.tokensTotal.toLocaleString()}</b></span></div>
              </div>
              <div className="row2" style={{ marginTop: 12 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>单次分析 token 预算（0 = 不限）</label>
                  <input
                    type="text"
                    value={String(s.budgetTokens ?? 0)}
                    onChange={(e) => setS({ ...s, budgetTokens: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                  />
                  <div className="mut" style={{ fontSize: 11, marginTop: 4 }}>
                    超限后 LLM 阶段降级为开放问题，静态结论照常产出，不会整单失败。
                  </div>
                </div>
                <div>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={async () => {
                      const res = await fetch("/api/stats", { method: "DELETE" });
                      const data = await res.json();
                      setCleared(res.ok ? `已清空 ${data.cleared} 条缓存（不影响已生成的知识点）` : (data.error ?? "清理失败"));
                      void loadStats();
                    }}
                  >
                    清空模型缓存
                  </button>
                  {cleared && <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>{cleared}</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="notice">
        <span className="badge b-none">说明</span>
        免费额度优先（服务商预设），付费 API 保底；仅接入官方开放接口。
      </div>
    </div>
  );

  return (
    <AppShell
      title="设置与授权"
      subtitle="模型服务 · 授权 · 安全 · 便携"
      items={[
        { no: "00", label: "从这里开始", href: "/" },
        { no: "01", label: "设置与授权", href: "/settings" },
      ]}
      foot={
        <>
          密钥只写不读
          <br />
          出站过滤器强制执行
        </>
      }
    >
      {body}
    </AppShell>
  );
}
