"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type NodeRow = { id: number; slug: string; title: string; kind: string; summary: string | null; status: string };
type TermRow = { id: number; slug: string; title: string; plain_def: string | null; pro_def: string | null; example: string | null; pitfall: string | null; avoid_aliases: string[]; category: string | null; usage: string | null; confusion: { other: string; rows: { dim: string; a: string; b: string }[] } | null };
type MasteryRow = { node_id: number; status: string; due: string; reps: number };
type DueRow = { nodeId: number; title: string; slug: string; kind: string; status: string; evidenceNote?: string | null; summary?: string | null };
type TechPathData = { analysisVersion: string | null; paths: { id: number; tech_name: string; tech_version: string | null; reason: string | null; concepts: { seq: number; concept_title: string; concept_slug: string; why_needed: string | null; project_ref: string | null; prereq_item_id: number | null }[] }[] };

const KIND_LABEL: Record<string, string> = { module: "模块", flow: "业务功能", concept: "核心概念", api: "执行机制", data: "数据" };

function parseEvPath(note: string | null): string | null {
  const m = (note ?? "").match(/[\w./-]+\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue)(?::\d+)?/);
  return m ? m[1] : null;
}
function parseEvLine(note: string | null): number | null {
  const m = (note ?? "").match(/\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue):(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function KbPage() {
  const { id } = useParams<{ id: string }>();
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [mastery, setMastery] = useState<MasteryRow[]>([]);
  const [due, setDue] = useState<DueRow[]>([]);
  const [view, setView] = useState<"kind" | "term" | "techpath">("kind");
  const [activeKind, setActiveKind] = useState<string>("");
  const [openTerm, setOpenTerm] = useState<TermRow | null>(null);
  const [techPaths, setTechPaths] = useState<TechPathData | null>(null);
  const [gradeMsg, setGradeMsg] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    const [n, t, m, tp] = await Promise.all([
      fetch(`/api/projects/${id}/nodes`).then((r) => r.json()),
      fetch(`/api/projects/${id}/terms`).then((r) => r.json()),
      fetch(`/api/projects/${id}/mastery`).then((r) => r.json()),
      fetch(`/api/projects/${id}/techpath`).then((r) => r.json()).catch(() => ({ paths: [] })),
    ]);
    setNodes(n.nodes ?? []);
    setTerms(t.terms ?? []);
    setMastery(m.items ?? []);
    setDue(m.due ?? []);
    setTechPaths(tp);
    if ((n.nodes ?? []).length > 0) {
      const kinds = Array.from(new Set((n.nodes as NodeRow[]).map((x: NodeRow) => x.kind)));
      setActiveKind((cur: string) => (cur && kinds.includes(cur) ? cur : kinds[0]));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const masteryMap = useMemo(() => {
    const map: Record<number, MasteryRow> = {};
    for (const m of mastery) map[m.node_id] = m;
    return map;
  }, [mastery]);

  const mastered = mastery.filter((m) => m.status === "mastered").length;
  const kinds = Array.from(new Set(nodes.map((n) => n.kind)));

  async function grade(nodeId: number, rating: "again" | "good" | "easy") {
    const res = await fetch(`/api/projects/${id}/mastery`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, rating, independent: true }),
    });
    const data = await res.json();
    if (!res.ok) { setGradeMsg(data.error ?? "记录失败"); return; }
    setGradeMsg(`${data.status === "mastered" ? "已标记掌握" : "已加入复习"} · 下次 ${data.due?.slice(0, 10)}（${data.intervalDays} 天后）`);
    void load();
  }

  return (
    <div>
      <div className="crumb">KNOWLEDGE BASE / 知识库体系</div>
      <h1 className="t">知识库</h1>
      <p className="sub">学到的一切都沉淀在这里：知识点、术语、掌握状态与到期复习。浏览与复习都不消耗 token。</p>

      <div className="grid3" style={{ marginTop: 16 }}>
        <div className="card"><div className="bd" style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 800 }}>{nodes.length}</div><div className="mut" style={{ fontSize: 11 }}>知识点 · 来自本项目分析</div></div></div>
        <div className="card"><div className="bd" style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 800, color: "var(--pass-green)" }}>{mastered}</div><div className="mut" style={{ fontSize: 11 }}>已验证掌握（独立练习证据）</div></div></div>
        <div className="card"><div className="bd" style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 800, color: "var(--evidence-amber)" }}>{due.length}</div><div className="mut" style={{ fontSize: 11 }}>今日到期复习（FSRS 调度）</div></div></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">KB-R1</span><b>今日复习队列</b><span className="right badge b-infer">先回忆，再翻面，最后才看答案</span></div>
        <div className="bd">
          {gradeMsg && <p className="mut" style={{ fontSize: 12, marginBottom: 8 }}>{gradeMsg}</p>}
          {due.length === 0 ? (
            <p className="mut" style={{ fontSize: 12.5 }}>今天没有到期卡片。学到新知识点后，FSRS 会按你的记忆状态安排下次复习。</p>
          ) : (
            <div className="grid3">
              {due.slice(0, 6).map((d) => (
                <div key={d.nodeId} className={`flip${flipped[d.nodeId] ? " flipped" : ""}`} style={{ minHeight: 150 }}>
                  <div className="flip-inner">
                    <div className="face card" style={{ padding: 12, cursor: "pointer", minHeight: 150 }} onClick={() => setFlipped((f) => ({ ...f, [d.nodeId]: true }))}>
                      <div style={{ fontSize: 11, color: "var(--evidence-amber)", fontWeight: 700 }}>REVIEW · {KIND_LABEL[d.kind] ?? d.kind}</div>
                      <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.8, fontWeight: 600 }}>
                        不看资料，用自己的话说清楚：<br />「{d.title}」是什么、在本项目里怎么用？
                      </div>
                      <div className="mut" style={{ fontSize: 11, marginTop: 8 }}>点击卡片翻面</div>
                    </div>
                    <div className="face back card" style={{ padding: 12, border: "1px solid var(--pass-green)", minHeight: 150 }}>
                      <div style={{ fontSize: 11, color: "var(--pass-green)", fontWeight: 700 }}>自评</div>
                      <div className="mut" style={{ fontSize: 11.5, margin: "6px 0" }}>想不起来 → 忘了；想起来但磕绊 → 一般；顺畅讲清 → 记得。</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn sm" type="button" style={{ background: "var(--mark-red)", borderColor: "var(--mark-red)" }} onClick={() => grade(d.nodeId, "again")}>忘了</button>
                        <button className="btn sm ghost" type="button" onClick={() => grade(d.nodeId, "good")}>一般</button>
                        <button className="btn sm" type="button" style={{ background: "var(--pass-green)", borderColor: "var(--pass-green)" }} onClick={() => grade(d.nodeId, "easy")}>记得</button>
                      </div>
                      <Link className="mut" style={{ fontSize: 11, marginTop: 6, display: "block" }} href={`/project/${id}/node?slug=${encodeURIComponent(d.slug)}`}>打开知识点 →</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="toolrow" style={{ marginTop: 20 }}>
        <div className="depth">
          <button type="button" className={view === "kind" ? "on" : ""} onClick={() => setView("kind")}>按知识类型</button>
          <button type="button" className={view === "term" ? "on" : ""} onClick={() => setView("term")}>按术语</button>
          <button type="button" className={view === "techpath" ? "on" : ""} onClick={() => setView("techpath")}>按技术栈路径</button>
        </div>
      </div>

      {view === "kind" && (
        <div className="grid2" style={{ gridTemplateColumns: "230px 1fr", marginTop: 14 }}>
          <div className="card">
            <div className="hd"><span className="file-no">KIND</span><b>知识类型</b></div>
            <div className="bd" style={{ padding: "8px 0" }}>
              {kinds.map((k) => {
                const list = nodes.filter((n) => n.kind === k);
                const done = list.filter((n) => masteryMap[n.id]?.status === "mastered").length;
                return (
                  <div key={k} className={`crow${activeKind === k ? " on" : ""}`} onClick={() => setActiveKind(k)}>
                    <b style={{ fontSize: 13 }}>{KIND_LABEL[k] ?? k}</b>
                    <span className="mut" style={{ fontSize: 11, marginLeft: "auto" }}>{done}/{list.length}</span>
                  </div>
                );
              })}
              {kinds.length === 0 && <p className="mut" style={{ fontSize: 12, padding: 10 }}>尚无知识点</p>}
            </div>
          </div>
          <div className="card">
            <div className="hd"><span className="file-no">{activeKind.toUpperCase()}</span><b>{KIND_LABEL[activeKind] ?? activeKind}</b></div>
            <div className="bd">
              {nodes.filter((n) => n.kind === activeKind).map((n) => {
                const m = masteryMap[n.id];
                const st = m?.status ?? "unlearned";
                const cls = st === "mastered" ? "b-run" : st === "learning" ? "b-infer" : "b-none";
                return (
                  <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px dashed var(--grid)" }}>
                    <div style={{ flex: 1 }}>
                      <Link href={`/project/${id}/node?slug=${encodeURIComponent(n.slug)}`} style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</Link>
                      {n.summary && <div className="mut" style={{ fontSize: 11.5, marginTop: 2 }}>{n.summary}</div>}
                    </div>
                    <span className={`badge ${cls}`}>{st === "mastered" ? "已验证掌握" : st === "learning" ? "练习中" : "未学习"}</span>
                  </div>
                );
              })}
              {nodes.filter((n) => n.kind === activeKind).length === 0 && <p className="mut" style={{ fontSize: 12 }}>该类型下暂无知识点。</p>}
            </div>
          </div>
        </div>
      )}

      {view === "term" && (
        <div className="card">
          <div className="hd"><span className="file-no">TERMS</span><b>术语表</b><span className="right mut" style={{ fontSize: 11 }}>已理解才收录 · 含 Avoid 别名裁决</span></div>
          <div className="bd" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {terms.map((t) => <span key={t.id} className="chip" onClick={() => setOpenTerm(t)}>{t.title}</span>)}
            {terms.length === 0 && <span className="mut" style={{ fontSize: 12 }}>尚无术语（运行 map 后由模型归并生成）。</span>}
          </div>
        </div>
      )}

      {view === "techpath" && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="hd"><span className="file-no">TP</span><b>技术栈学习路径</b>
            <span className="right mut" style={{ fontSize: 11 }}>从依赖自动生成 · 每条挂到项目真实代码 · 按学习顺序排列</span>
          </div>
          <div className="bd" style={{ padding: 0 }}>
            {(techPaths?.paths ?? []).length === 0 ? (
              <p className="mut" style={{ padding: 20, fontSize: 12.5 }}>尚无技术栈路径（运行 map 后从项目依赖自动生成）。</p>
            ) : (
              (techPaths?.paths ?? []).map((path) => (
                <div key={path.id} style={{ padding: "14px 18px", borderBottom: "1px solid var(--grid)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <b style={{ fontSize: 14 }}>{path.tech_name}</b>
                    {path.tech_version && <span className="badge b-src">v{path.tech_version}</span>}
                  </div>
                  {path.reason && <p className="mut" style={{ fontSize: 11.5, margin: "4px 0 10px" }}>{path.reason}</p>}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {path.concepts.map((c, i) => (
                      <div key={c.seq} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: i < path.concepts.length - 1 ? "1px dashed var(--grid)" : "none" }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "var(--ink)" : "var(--grid)", color: i === 0 ? "#fff" : "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{c.seq}</div>
                        <div style={{ flex: 1 }}>
                          <Link href={`/project/${id}/node?slug=${encodeURIComponent(c.concept_slug)}`} style={{ fontWeight: 600, fontSize: 13 }}>{c.concept_title}</Link>
                          {c.why_needed && <div className="mut" style={{ fontSize: 11.5, marginTop: 2 }}>{c.why_needed}</div>}
                          {c.project_ref && (
                            <Link href={`/project/${id}/code?path=${encodeURIComponent(parseEvPath(c.project_ref) ?? "")}${parseEvLine(c.project_ref) ? `&line=${parseEvLine(c.project_ref)}` : ""}`} className="mono" style={{ fontSize: 11, color: "var(--evidence-amber)" }}>
                              ↳ {c.project_ref}
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {openTerm && (
        <div className="mask on" onClick={(e) => { if (e.target === e.currentTarget) setOpenTerm(null); }}>
          <div className="modal">
            <h3><span className="file-no">TERM</span>{openTerm.title}<span className="x" onClick={() => setOpenTerm(null)}>✕</span></h3>
            <div className="term-body">
              <div><span className="k">先说人话</span>：{openTerm.plain_def ?? "—"}</div>
              <div><span className="k">专业定义</span>：{openTerm.pro_def ?? "—"}</div>
              <div><span className="k">最小示例</span>：<code>{openTerm.example ?? "—"}</code></div>
              <div><span className="k">常见误区</span>：{openTerm.pitfall ?? "—"}</div>
              {openTerm.avoid_aliases.length > 0 && <div><span className="k">Avoid 别名</span>：{openTerm.avoid_aliases.join("、")}</div>}
              {openTerm.confusion && (
                <table className="cmp"><tbody>
                  <tr><th>对比项</th><th>{openTerm.title}</th><th>{openTerm.confusion.other}</th></tr>
                  {openTerm.confusion.rows.map((r, i) => <tr key={i}><td>{r.dim}</td><td>{r.a}</td><td>{r.b}</td></tr>)}
                </tbody></table>
              )}
            </div>
            <div className="notice">
              <span>术语来自本项目分析产物。</span>
              <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setOpenTerm(null)}>返回原位置</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
