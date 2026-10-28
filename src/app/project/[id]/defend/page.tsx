"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { isFinal: boolean; 0: { transcript: string } }[]; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

type Item = { id: number; kind: string; prompt: string; answer: string | null; hints: string | null; target_file: string | null; target_line: number | null };
type Score = { mode: string; axisA: number; axisB: number; gapsA: string; gapsB: string; reference: string; note?: string };

export default function DefendPage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<Score | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [phase, setPhase] = useState<"ask" | "scored" | "recall" | "done">("ask");
  const [recall, setRecall] = useState("");
  const [busy, setBusy] = useState(false);
  const [weak, setWeak] = useState<string[]>([]);
  // 追问链
  const [fDepth, setFDepth] = useState(0);
  const [fChain, setFChain] = useState<{ q: string; a: string }[]>([]);
  const [fQuestion, setFQuestion] = useState<string | null>(null);
  const [fRef, setFRef] = useState<string | null>(null);
  const [fReason, setFReason] = useState<string | null>(null);
  const [fBusy, setFBusy] = useState(false);
  const [fScore, setFScore] = useState<{ axisA: number; axisB: number; gapsA: string; gapsB: string } | null>(null);
  const [cErr, setCErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recOn, setRecOn] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/practice`);
    if (res.ok) {
      const data = (await res.json()) as { items: Item[] };
      setItems((data.items ?? []).filter((p) => p.kind === "quiz"));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const item = items[idx];
  const hints = (() => {
    try {
      return JSON.parse(item?.hints ?? "[]") as string[];
    } catch {
      return [];
    }
  })();

  // P3.5 语音作答：浏览器原生 Web Speech（localhost 免费可用）；不支持时降级打字
  const recRef = useRef<{ stop: () => void } | null>(null);
  function micToggle() {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) {
      setAnswer((a) => a + "（当前浏览器不支持语音识别，请用 Chrome/Edge 或直接打字）");
      return;
    }
    if (recOn && recRef.current) {
      recRef.current.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = true;
    let base = answer;
    rec.onresult = (e: { results: { isFinal: boolean; 0: { transcript: string } }[]; resultIndex: number }) => {
      let fin = "";
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else inter += t;
      }
      if (fin) base += fin;
      setAnswer(base + inter);
    };
    rec.onend = () => setRecOn(false);
    rec.onerror = () => setRecOn(false);
    rec.start();
    recRef.current = rec;
    setRecOn(true);
  }

  async function genFollowup() {
    if (!item) return;
    setFBusy(true);
    const chain = fChain.length > 0 ? fChain : [{ q: item.prompt, a: answer }];
    const res = await fetch(`/api/projects/${id}/defend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "followup", itemId: item.id,
        depth: fDepth, chain,
        answer: answer, targetFile: item.target_file ?? undefined, targetLine: item.target_line ?? undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.question) {
      setFQuestion(data.question);
      setFRef(data.reference);
      setFReason(data.reason);
      setFDepth((d) => d + 1);
    } else {
      setCErr(data.error ?? "追问生成失败");
    }
  }

  async function submitFollowup() {
    if (!fQuestion || !answer.trim()) return;
    setFBusy(true);
    const res = await fetch(`/api/projects/${id}/defend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, answer, action: "score" }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setFScore({ axisA: data.axisA, axisB: data.axisB, gapsA: data.gapsA, gapsB: data.gapsB });
      setFChain((c) => [...c, { q: fQuestion, a: answer }]);
      if (data.axisB < 3) setWeak((w) => Array.from(new Set([...w, fQuestion.slice(0, 24)])));
    }
  }

  async function submit() {
    if (!item || !answer.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${id}/defend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, answer }),
    });
    const data = await res.json();
    if (!res.ok) {
      setScore({ mode: "error", axisA: 0, axisB: 0, gapsA: data.error ?? "评分失败", gapsB: "", reference: item.answer ?? "" });
    } else {
      setScore(data);
      if (data.axisB < 3) setWeak((w) => Array.from(new Set([...w, item.prompt.slice(0, 24)])));
      // P3.1 学习记录：本次作答的证据（提示次数/是否看答案/是否独立）
      void fetch(`/api/projects/${id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          kind: "quiz",
          correct: data.axisB >= 3,
          hintsUsed: hintLevel,
          viewedAnswer: hintLevel >= hints.length,
          independent: hintLevel === 0,
          answerText: answer,
        }),
      });
    }
    setPhase("scored");
    setBusy(false);
  }

  function next() {
    if (idx < items.length - 1) {
      setIdx(idx + 1);
      setPhase("ask");
      setAnswer("");
      setScore(null);
      setHintLevel(0);
    } else {
      setPhase("recall");
    }
  }

  if (loading) return <p className="sub">加载中…</p>;
  if (!items.length) {
    return (
      <div>
        <h1 className="t">答辩模拟</h1>
        <p className="sub">尚无答辩题。运行一次「完整分析（map）」后，由模型基于本项目证据生成；未配 Key 时不会伪造题目。</p>
        <Link className="btn sm" href={`/project/${id}/map`}>去启动分析 →</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="crumb">DEFEND / 答辩模拟 / 模式：功能实现原理</div>
      <h1 className="t">
        模拟答辩 · 第 {Math.min(idx + 1, items.length)} 问 / 共 {items.length} 问
      </h1>
      <p className="sub">
        一次只问一个问题。回答后会看到两轴评分——它们独立打分，不合并成总分。
        <span className="badge b-ai" style={{ marginLeft: 8 }}>评分依据预置要点与项目证据</span>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start", marginTop: 18 }}>
        <div>
          <div className="chat">
            <div className="msg judge">
              <span className="badge b-ai">评委</span>
              <br />
              <b>第 {idx + 1} 问：</b>{item?.prompt}
            </div>
            {phase === "ask" && (
              <>
                <div className="msg me" style={{ opacity: 0.75 }}>（像答辩现场一样，口述或键入你的回答…）</div>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="口述或键入你的回答…（🎙 可语音输入）"
                  style={{ width: "100%", maxWidth: 900, minHeight: 90, border: "1px solid var(--line)", borderRadius: 8, padding: 12, fontSize: 13 }}
                />
                <div className="toolrow" style={{ marginBottom: 0 }}>
                  <button className="btn" type="button" disabled={busy || !answer.trim()} onClick={submit}>
                    {busy ? "评分中…" : "提交回答"}
                  </button>
                  <button className={`btn sm ghost${recOn ? " rec" : ""}`} type="button" onClick={micToggle}>
                    {recOn ? "⏺ 停止录音" : "🎙 语音作答"}
                  </button>
                  {hints.length > 0 && <button className="btn sm ghost" type="button" onClick={() => setHintLevel((h) => Math.min(h + 1, hints.length))}>要提示（{hintLevel}/{hints.length}）</button>}
                </div>
                {hintLevel > 0 && (
                  <div className="hintstep">
                    <b style={{ color: "var(--evidence-amber)" }}>阶梯提示（每级都算一次"用了提示"，影响掌握判定）</b>
                    {hints.slice(0, hintLevel).map((h, i) => (
                      <div key={i}>· {h}</div>
                    ))}
                  </div>
                )}
              </>
            )}

            {phase !== "ask" && score && (
              <>
                <div className="msg me">{answer}</div>
                <div className="msg judge">
                  <b>评委点评：</b>
                  <div className="score2">
                    <div className="ax">
                      <div className="t">轴 A · 代码事实自洽</div>
                      <div className="v" style={{ color: score.axisA >= 4 ? "var(--pass-green)" : "var(--mark-red)" }}>
                        {score.axisA}<span style={{ fontSize: 12, color: "var(--muted)" }}>/5</span>
                      </div>
                      <div className="gaps">{score.gapsA}</div>
                    </div>
                    <div className="ax">
                      <div className="t">轴 B · 兑现声称</div>
                      <div className="v" style={{ color: score.axisB >= 4 ? "var(--pass-green)" : "var(--mark-red)" }}>
                        {score.axisB}<span style={{ fontSize: 12, color: "var(--muted)" }}>/5</span>
                      </div>
                      <div className="gaps">{score.gapsB}</div>
                    </div>
                  </div>
                  <div className="notice" style={{ border: 0, paddingTop: 8 }}>
                    参考答案要点：{score.reference}
                    {score.mode === "heuristic" && <span className="badge b-infer" style={{ marginLeft: 6 }}>启发式评分（未接入模型）</span>}
                    {score.note && <span className="mut" style={{ fontSize: 11, display: "block", marginTop: 4 }}>{score.note}</span>}
                  </div>
                  {item?.target_file && (
                    <div className="notice" style={{ border: 0 }}>
                      证据位置：
                      <Link href={`/project/${id}/code?path=${encodeURIComponent(item.target_file)}${item.target_line ? `&line=${item.target_line}` : ""}`} style={{ color: "#3D4FA1", textDecoration: "underline" }}>
                        {item.target_file}:{item.target_line ?? ""}
                      </Link>
                    </div>
                  )}
                </div>

                {/* 追问链 */}
                {fQuestion && (
                  <div className="msg judge" style={{ marginTop: 10 }}>
                    <div className="chain-breadcrumb">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className={`link-seg${i === fDepth - 1 ? " cur" : i < fDepth - 1 ? "" : ""}`} style={i < fDepth - 1 ? { background: "var(--pass-green)", color: "#fff" } : i === fDepth - 1 ? {} : {}}>
                          {["表层", "原理", "边界"][i]}
                        </span>
                      ))}
                      <span style={{ marginLeft: 6, color: "var(--evidence-amber)" }}>追问深度 {fDepth}/3</span>
                    </div>
                    <span className="followup-tag">评委追问</span>
                    <div style={{ marginTop: 6 }}><b>{fQuestion}</b></div>
                  </div>
                )}

                {fQuestion && fScore && fDepth > 0 && (
                  <div style={{ marginTop: 10, maxWidth: 900 }}>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="回答追问…"
                      style={{ width: "100%", minHeight: 60, border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 12.5 }}
                    />
                    <button className="btn sm" type="button" onClick={submitFollowup} disabled={!answer.trim() || fBusy}>
                      {fBusy ? "评分中…" : "提交追问回答"}
                    </button>
                    {fScore && (
                      <div className="score2" style={{ marginTop: 8 }}>
                        <div className="ax"><div className="t">轴 A</div><div className="v" style={{ color: fScore.axisA >= 4 ? "var(--pass-green)" : "var(--mark-red)" }}>{fScore.axisA}/5</div><div className="gaps">{fScore.gapsA}</div></div>
                        <div className="ax"><div className="t">轴 B</div><div className="v" style={{ color: fScore.axisB >= 4 ? "var(--pass-green)" : "var(--mark-red)" }}>{fScore.axisB}/5</div><div className="gaps">{fScore.gapsB}</div></div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {phase === "recall" && (
              <div className="recall">
                <b>终局检验 · 关掉一切参考，把整条业务链完整讲一遍</b>
                <div className="mut" style={{ fontSize: 11.5, margin: "4px 0" }}>
                  这一步区分"记住了 AI 的讲解"和"真的会了"——是掌握判定的最后一关。
                </div>
                <textarea value={recall} onChange={(e) => setRecall(e.target.value)} placeholder="你的完整复述…" />
                <button className="btn" type="button" disabled={!recall.trim()} onClick={() => setPhase("done")}>提交复述</button>
              </div>
            )}

            {phase === "done" && (
              <div className="recall" style={{ borderColor: "var(--pass-green)" }}>
                <b style={{ color: "var(--pass-green)" }}>本轮结束</b>
                <div style={{ fontSize: 12.5, marginTop: 6 }} className="mut">
                  复述已提交。薄弱点会同步回学习路径（当前会话内统计；跨会话记录属 P3）。
                </div>
                <div className="toolrow" style={{ marginBottom: 0 }}>
                  <button className="btn" type="button" onClick={() => { setIdx(0); setPhase("ask"); setAnswer(""); setScore(null); setRecall(""); setHintLevel(0); }}>
                    再来一轮
                  </button>
                  <Link className="btn sm ghost" href={`/project/${id}/radar`}>查看能力雷达</Link>
                </div>
              </div>
            )}
          </div>

          {phase === "scored" && score && (
            <div className="toolrow">
              {score.axisB < 4 && fDepth < 3 && !fQuestion && (
                <button className="btn" type="button" style={{ background: "var(--evidence-amber)", borderColor: "var(--evidence-amber)" }} onClick={genFollowup}>
                  ⚡ 评委追问 →
                </button>
              )}
              {fQuestion && fDepth < 3 && (
                <button className="btn sm ghost" type="button" onClick={genFollowup}>
                  继续追问（第 {fDepth + 1} 层）
                </button>
              )}
              <button className="btn" type="button" onClick={next}>
                {idx < items.length - 1 ? "下一问 →" : "进入终局：不看答案复述"}
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="hd"><span className="file-no">DR-01</span><b>本轮薄弱点</b></div>
            <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
              {weak.length === 0 ? <span className="mut">暂无（轴 B 评分 &lt; 3 的题会登记在这里）</span> : weak.map((w, i) => <div key={i}>· {w}…</div>)}
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="hd"><span className="file-no">DR-02</span><b>缺口对应知识点</b></div>
            <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.2 }}>
              <Link href={`/project/${id}/node`} style={{ color: "#3D4FA1", textDecoration: "underline" }}>知识点页</Link><br />
              <Link href={`/project/${id}/kb`} style={{ color: "#3D4FA1", textDecoration: "underline" }}>知识库 · 复习队列</Link><br />
              <Link href={`/project/${id}/flow`} style={{ color: "#3D4FA1", textDecoration: "underline" }}>业务流程线</Link>
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="hd"><span className="file-no">DR-03</span><b>诚实边界</b></div>
            <div className="bd mut" style={{ fontSize: 11.5, lineHeight: 1.9 }}>
              评分必须引用预置要点与证据；未配 Key 时为启发式关键词覆盖，仅供自查。体检发现只作"疑似"题源，不当确定缺陷。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
