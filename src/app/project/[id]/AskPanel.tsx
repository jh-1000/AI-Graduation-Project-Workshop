"use client";

import Link from "next/link";
import { useState } from "react";

type Match = { type: string; label: string; text: string; href: string | null };
type AskResult = { mode: string; answer: string | null; matches: Match[]; gap: string | null; nextCheck: string | null };

/**
 * 全局学习助手（P3.3）：检索召回（词法+图谱数据）→ 证据绑定回答 → 不足明说。
 * 未配 Key 时只给检索结果，同样诚实。
 */
export default function AskPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [history, setHistory] = useState<{ q: string; r: AskResult }[]>([]);

  async function ask() {
    if (!question.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    setHistory((h) => [{ q: question, r: data }, ...h].slice(0, 5));
    setResult(data);
    setBusy(false);
    setQuestion("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", right: 26, bottom: 26, width: 54, height: 54, borderRadius: "50%",
          background: "var(--ink)", color: "#fff", border: 0, cursor: "pointer", fontSize: 22,
          boxShadow: "0 8px 24px rgba(27,42,74,.35)", zIndex: 60,
        }}
        title="学习助手"
      >
        🤖
      </button>

      {open && (
        <div style={{ position: "fixed", right: 26, bottom: 92, width: 400, maxHeight: "72vh", background: "#fff", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,.28)", display: "flex", flexDirection: "column", zIndex: 60, overflow: "hidden" }}>
          <div style={{ background: "var(--ink)", color: "#fff", padding: "11px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            🤖 学习助手
            <span style={{ opacity: 0.7, fontSize: 11 }}>词法+图谱检索 · 只依据证据 · 不足明说</span>
            <span style={{ marginLeft: "auto", cursor: "pointer" }} onClick={() => setOpen(false)}>✕</span>
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, overflow: "auto", maxHeight: "52vh" }}>
            {history.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.9 }}>
                试试问：<br />· 这段代码谁在调用？<br />· 如果接口失败会发生什么？<br />· 状态和 props 有什么区别？
              </div>
            )}
            {history.map((h, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ alignSelf: "flex-end", background: "var(--ink)", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, maxWidth: "85%" }}>{h.q}</div>
                {h.r.answer ? (
                  <div style={{ alignSelf: "flex-start", background: "#EEF1F8", border: "1px solid #D6DEF2", borderLeft: "4px solid var(--evidence-amber)", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.9, maxWidth: "92%" }}>
                    {h.r.answer}
                    {h.r.matches.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11.5 }}>
                        <b style={{ color: "var(--evidence-amber)" }}>依据材料：</b>
                        {h.r.matches.map((m, k) => (
                          <div key={k}>
                            [{k + 1}] {m.type} · {m.label}
                            {m.href && <Link href={m.href} style={{ color: "#3D4FA1", textDecoration: "underline", marginLeft: 6 }}>打开 →</Link>}
                          </div>
                        ))}
                      </div>
                    )}
                    {h.r.gap && (
                      <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--mark-red)" }}>
                        ⚠ 材料不足：{h.r.gap}
                        {h.r.nextCheck && <div style={{ color: "var(--muted)" }}>下一步核查：{h.r.nextCheck}</div>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ alignSelf: "flex-start", background: "#FFFDF7", border: "1px dashed var(--evidence-amber)", padding: "10px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.8, maxWidth: "92%" }}>
                    <b style={{ color: "var(--evidence-amber)" }}>材料不足 / 未配模型</b>
                    <div>{h.r.gap}</div>
                    {h.r.matches.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        检索到的相关内容：
                        {h.r.matches.slice(0, 4).map((m, k) => (
                          <div key={k}>· {m.label}</div>
                        ))}
                      </div>
                    )}
                    {h.r.nextCheck && <div style={{ marginTop: 4 }}>下一步：{h.r.nextCheck}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--grid)", display: "flex", gap: 8 }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void ask(); }}
              placeholder="问任何关于这个项目的问题…"
              style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}
            />
            <button type="button" className="btn sm" disabled={busy || !question.trim()} onClick={ask}>
              {busy ? "检索中…" : "发送"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

