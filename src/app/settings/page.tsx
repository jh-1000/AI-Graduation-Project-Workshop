"use client";

import { useEffect, useState } from "react";

type Settings = {
  baseUrl: string;
  model: string;
  temperature: number;
  allowLocalModel: boolean;
  maxContextChars: number;
  apiKeyMasked: string | null;
};

// 免费额度优先，付费 API 保底；仅接入官方开放接口（客户端积分额度走私有协议，不做逆向适配）
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

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then(setS);
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
        apiKey: apiKey || undefined,
      }),
    });
    setSaved(true);
    setApiKey("");
    const fresh = await fetch("/api/settings").then((r) => r.json());
    setS(fresh);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!s) return <p className="text-sm text-slate-400">加载中…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">设置</h1>
      <p className="text-sm text-slate-500">
        OpenAI 兼容 API（GLM / DeepSeek / 本地 Ollama 均可）。密钥只写不读，页面上仅显示掩码。
        策略：<b>免费额度优先（服务商预设），付费 API 保底</b>。仅接入官方开放接口；客户端签到积分走私有协议，不做逆向适配。
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 text-xs text-slate-500">服务商预设（点选自动填 baseURL 与模型）</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs hover:border-slate-500"
              onClick={() => {
                setS((prev) => prev && { ...prev, baseUrl: p.base, model: p.model, ...(p.local ? { allowLocalModel: true } : {}) });
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">baseURL</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
            value={s.baseUrl}
            onChange={(e) => setS({ ...s, baseUrl: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">模型</span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
            value={s.model}
            onChange={(e) => setS({ ...s, model: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">
            API Key {s.apiKeyMasked && <span className="text-slate-400">（当前：{s.apiKeyMasked}）</span>}
          </span>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
            type="password"
            placeholder="输入新 Key 以更新；留空保持不变"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.allowLocalModel}
            onChange={(e) => setS({ ...s, allowLocalModel: e.target.checked })}
          />
          <span>允许本地/内网模型服务（如 Ollama，127.0.0.1）——明确授权后放行私网地址</span>
        </label>
        <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white" onClick={save}>
          {saved ? "已保存 ✓" : "保存设置"}
        </button>
      </div>
    </div>
  );
}
