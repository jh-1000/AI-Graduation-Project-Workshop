"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type FlowStep = { seq: number; title: string; file_path: string | null; start_line: number | null; note: string | null };
type Flow = { id: number; slug: string; title: string; trigger_desc: string | null; confidence: number | null; steps: FlowStep[] };
type Resp = { analysisVersion: string | null; flows: Flow[] };

export default function FlowPage() {
  const { id } = useParams<{ id: string }>();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [act, setAct] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [backOpen, setBackOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/flows`);
    if (res.ok) {
      const data = (await res.json()) as Resp;
      setFlows(data.flows ?? []);
      setActiveId(data.flows?.[0]?.id ?? null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="sub">加载中…</p>;

  const flow = flows.find((f) => f.id === activeId) ?? flows[0];
  const steps = flow?.steps ?? [];
  const cur = steps[Math.min(step, Math.max(steps.length - 1, 0))];

  return (
    <div>
      <div className="crumb">FLOW / 业务流程线 / 确定性追踪（静态证据，非猜测）</div>
      <h1 className="t">业务流程线{flow ? `：${flow.title}` : ""}</h1>
      <p className="sub">
        点击按钮之后发生了什么？沿着这条线走。<b style={{ color: "var(--mark-red)" }}>每一站都能：看懂 · 看代码 · 追下去 · 考考我。</b>
      </p>

      {flows.length === 0 ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="bd">
            <p style={{ fontSize: 13 }}>尚无业务流程。运行一次「完整分析（map）」后，系统会从端点与调用证据推导流程线。</p>
            <Link className="btn sm" href={`/project/${id}/map`}>去启动分析 →</Link>
          </div>
        </div>
      ) : (
        <>
          {flows.length > 1 && (
            <div className="toolrow">
              {flows.map((f) => (
                <span key={f.id} className={`tchip${f.id === flow?.id ? " on" : ""}`} style={f.id === flow?.id ? { background: "var(--ink)", color: "#fff" } : {}} onClick={() => { setActiveId(f.id); setStep(0); setAct(0); }}>
                  {f.title}
                </span>
              ))}
            </div>
          )}
          {flow?.trigger_desc && <p className="mut" style={{ fontSize: 12 }}>触发：{flow.trigger_desc} · 置信度 {flow.confidence ?? "—"}</p>}

          <div className="metro" style={{ marginTop: 22 }}>
            <div className="track">
              <div className="done" style={{ width: `${steps.length > 1 ? (step / (steps.length - 1)) * 100 : 0}%` }} />
            </div>
            {steps.map((s, i) => (
              <div key={s.seq} className={`station ${i === step ? "cur" : i < step ? "past" : ""}`} onClick={() => { setStep(i); setAct(0); }}>
                <div className="dot">{i + 1}</div>
                <div className="lbl">{s.title}</div>
              </div>
            ))}
          </div>

          {cur && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="hd">
                <span className="file-no">STEP {cur.seq}</span>
                <b>{cur.title}</b>
                <span className="right">
                  <span className={`badge ${cur.file_path ? "b-src" : "b-none"}`}>{cur.file_path ? "有源码证据" : "无证据"}</span>
                </span>
              </div>
              <div className="bd">
                <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
                  {act === 0 && (
                    <div>🧭 <b>看懂</b>：{cur.note ?? cur.title}</div>
                  )}
                  {act === 1 && (
                    <div className="ev">
                      <div className="t">证据卡 · 源码位置</div>
                      {cur.file_path ? (
                        <>
                          <Link className="loc mono" href={`/project/${id}/code?path=${encodeURIComponent(cur.file_path)}${cur.start_line ? `&line=${cur.start_line}` : ""}`}>
                            {cur.file_path}{cur.start_line ? `:${cur.start_line}` : ""}
                          </Link>
                          <div className="d">{cur.note ?? "该步骤对应的源码位置。"}</div>
                        </>
                      ) : (
                        <div className="d" style={{ color: "var(--mark-red)" }}>该步骤没有源码证据 —— 属于推断，已在开放问题中登记。</div>
                      )}
                    </div>
                  )}
                  {act === 2 && (
                    <div>
                      ➡️ <b>追下去</b>：
                      {step < steps.length - 1 ? (
                        <button className="btn sm" type="button" onClick={() => { setStep(step + 1); setAct(0); }}>
                          前往下一站 {steps[step + 1].title}
                        </button>
                      ) : (
                        <span className="mut">已是最后一站。</span>
                      )}
                      <button className="btn sm ghost" type="button" style={{ marginLeft: 8 }} onClick={() => setBackOpen(true)}>
                        ⟲ 反向追踪
                      </button>
                    </div>
                  )}
                  {act === 3 && (
                    <div>
                      <div style={{ fontSize: 12, color: "var(--mark-red)", letterSpacing: 2, fontWeight: 700 }}>考考我 · 主动回忆</div>
                      <div style={{ fontSize: 14, margin: "8px 0", fontWeight: 600 }}>
                        这一步在做什么？为什么它在链条的这个位置？
                      </div>
                      {revealed[`${flow?.id}-${cur.seq}`] ? (
                        <div className="ev"><div className="d">{cur.note ?? cur.title}</div></div>
                      ) : (
                        <button className="btn sm" type="button" onClick={() => setRevealed((r) => ({ ...r, [`${flow?.id}-${cur.seq}`]: true }))}>
                          先自己想，再看答案
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="toolrow" style={{ marginBottom: 0 }}>
                  {[["看懂", 0], ["看代码", 1], ["追下去", 2], ["考考我", 3]].map(([label, a]) => (
                    <button key={label as string} className={`btn sm ${act === a ? "" : "ghost"}`} type="button" onClick={() => setAct(a as number)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {backOpen && flow && (
            <div className="mask on" onClick={(e) => { if (e.target === e.currentTarget) setBackOpen(false); }}>
              <div className="modal">
                <h3>
                  <span className="file-no">BACK-TRACE</span>反向追踪 · 从「{cur?.title}」回到触发点
                  <span className="x" onClick={() => setBackOpen(false)}>✕</span>
                </h3>
                <div className="term-body">
                  {steps.slice(0, step + 1).reverse().map((s, i) => (
                    <div key={s.seq} style={{ padding: "7px 0", borderBottom: "1px dashed var(--grid)" }}>
                      <b className="mono" style={{ color: "var(--evidence-amber)" }}>{i === 0 ? "◆" : "↑"}</b>{" "}
                      {s.seq}. {s.title}
                      {s.file_path && <span className="mono mut" style={{ fontSize: 11 }}>　{s.file_path}:{s.start_line ?? ""}</span>}
                    </div>
                  ))}
                </div>
                <div className="notice">
                  <span>任何一步都可以反查「谁触发的、上一步是什么」。反向链只看已记录的证据。</span>
                  <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setBackOpen(false)}>关闭</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
