"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

type Section = { heading: string; body: string };
type NodeRow = {
  id: number;
  slug: string;
  title: string;
  kind: string;
  summary: string | null;
  sections: Section[];
  evidence_note: string | null;
  status: string;
};
type Fable = {
  story: string;
  reveal: string;
  mapping: { story_element: string; concept: string }[];
  backToProject: string;
  limitations: string[];
};

const KIND_LABEL: Record<string, string> = {
  module: "模块",
  flow: "业务功能",
  concept: "核心概念",
  api: "执行机制",
  data: "数据",
};

function parseEvPath(note: string | null): string | null {
  const m = (note ?? "").match(/[\w./\-]+\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue)(?::\d+)?/);
  return m ? m[1] : null;
}
function parseEvLine(note: string | null): number | null {
  const m = (note ?? "").match(/\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue):(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function NodePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(params.get("slug"));
  const [depth, setDepth] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [fableBusy, setFableBusy] = useState(false);
  const [fableErr, setFableErr] = useState<string | null>(null);
  const [masteryMsg, setMasteryMsg] = useState<string | null>(null);
  // 升级 2：影响探针
  const [probe, setProbe] = useState<any>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  // 升级 3：换一种写法
  const [alts, setAlts] = useState<any>(null);
  const [altsBusy, setAltsBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/nodes`);
    if (!res.ok) return;
    const data = (await res.json()) as { nodes: NodeRow[] };
    setNodes(data.nodes ?? []);
    if (!activeSlug && data.nodes?.length) setActiveSlug(data.nodes[0].slug);
  }, [id, activeSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const node = useMemo(
    () => nodes.find((n) => n.slug === activeSlug) ?? nodes[0],
    [nodes, activeSlug]
  );

  const limit = depth === 0 ? 3 : depth === 1 ? 6 : 99;
  const plainSections = (node?.sections ?? []).filter((s) => s.heading !== "寓言卡");
  const fableSection = (node?.sections ?? []).find((s) => s.heading === "寓言卡");
  const fable = useMemo<Fable | null>(() => {
    if (!fableSection) return null;
    try {
      return JSON.parse(fableSection.body) as Fable;
    } catch {
      return null;
    }
  }, [fableSection]);

  async function genFable() {
    if (!node) return;
    setFableBusy(true);
    setFableErr(null);
    const res = await fetch(`/api/projects/${id}/fable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: node.id }),
    });
    const data = await res.json();
    if (!res.ok) setFableErr(data.error ?? "生成失败");
    else await load();
    setFableBusy(false);
  }

  // 升级 2：影响探针
  async function runProbe() {
    if (!node?.evidence_note) return;
    setProbeBusy(true);
    const fp = parseEvPath(node.evidence_note);
    const fl = parseEvLine(node.evidence_note);
    const res = await fetch(`/api/projects/${id}/probe`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: fp, line: fl, mutation: `注释掉「${node.title}」关键行`, verifyCommand: "npm run typecheck" }),
    });
    const data = await res.json();
    setProbe(data);
    setProbeBusy(false);
  }

  // 升级 3：换一种写法
  async function genAlts() {
    if (!node?.evidence_note) return;
    setAltsBusy(true);
    const fp = parseEvPath(node.evidence_note);
    const fl = parseEvLine(node.evidence_note);
    const res = await fetch(`/api/projects/${id}/alternatives`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: node.id, filePath: fp, startLine: fl, endLine: fl ? fl + 15 : undefined }),
    });
    const data = await res.json();
    setAlts(data);
    setAltsBusy(false);
  }

  async function mark(rating: "good" | "again") {
    if (!node) return;
    const res = await fetch(`/api/projects/${id}/mastery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: node.id, rating, independent: rating === "good" }),
    });
    const data = await res.json();
    setMasteryMsg(res.ok ? `已记录：${data.status === "mastered" ? "已验证掌握" : "练习中"} · 下次复习 ${data.due?.slice(0, 10)}` : (data.error ?? "记录失败"));
  }

  if (!nodes.length) {
    return (
      <div>
        <h1 className="t">知识点</h1>
        <p className="sub">尚无知识点。运行一次「完整分析（map）」后生成；未配置 API Key 时会写入开放问题而非伪造内容。</p>
        <Link className="btn sm" href={`/project/${id}/map`}>去启动分析 →</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="toolrow">
        <div className="crumb" style={{ margin: 0 }}>
          NODE / {KIND_LABEL[node?.kind ?? ""] ?? node?.kind}
        </div>
        <select
          value={node?.slug}
          onChange={(e) => setActiveSlug(e.target.value)}
          style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "5px 10px", fontSize: 12.5, background: "#fff" }}
        >
          {nodes.map((n) => (
            <option key={n.slug} value={n.slug}>{n.title}</option>
          ))}
        </select>
        <div className="depth" style={{ marginLeft: "auto" }}>
          <button type="button" className={depth === 0 ? "on" : ""} onClick={() => setDepth(0)}>从零开始</button>
          <button type="button" className={depth === 1 ? "on" : ""} onClick={() => setDepth(1)}>结合项目学习</button>
          <button type="button" className={depth === 2 ? "on" : ""} onClick={() => setDepth(2)}>深入原理</button>
        </div>
      </div>

      <h1 className="t">{node?.title}</h1>
      <p className="sub">
        同一条证据链，三种讲法。切换深度不会互相矛盾——它们来自同一份核验事实。
        {node?.status === "pending_review" && <span className="badge b-infer" style={{ marginLeft: 8 }}>待复核</span>}
      </p>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="hd">
          <span className="file-no">NODE-E1</span><b>先看结论（带证据）</b>
          <span className="right">
            <span className="badge b-src">源码事实</span>
            <span className="badge b-none">未运行验证</span>
          </span>
        </div>
        <div className="bd" style={{ fontSize: 13.5, lineHeight: 1.9 }}>
          {node?.summary ?? "（无摘要）"}
          {node?.evidence_note && (
            <div className="ev">
              <div className="t">证据 · 已关联</div>
              <Link
                className="loc mono"
                href={`/project/${id}/code?path=${encodeURIComponent(parseEvidencePath(node.evidence_note) ?? "")}${parseEvidenceLine(node.evidence_note) ? `&line=${parseEvidenceLine(node.evidence_note)}` : ""}`}
              >
                {node.evidence_note}
              </Link>
              <div className="d">该结论的具体依据位置。点击在代码库中打开并高亮。</div>
            </div>
          )}
          {!node?.evidence_note && (
            <div className="not-proved" style={{ marginTop: 10, border: "1px dashed var(--mark-red)", borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--mark-red)" }}>
              <b>证据缺口</b>：该知识点未挂源码位置，属于推断类内容，请勿当作已核实事实。
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd">
          <span className="file-no">NODE-E2</span><b>分段讲解（按你的节奏展开）</b>
          <span className="right">
            <span className="badge b-ai">AI 组织讲解 · 基于核验证据</span>
          </span>
        </div>
        <div className="bd" style={{ padding: "6px 0 10px" }}>
          {plainSections.length === 0 && <p className="mut" style={{ padding: "0 18px", fontSize: 12.5 }}>尚无分段讲解。</p>}
          {plainSections.slice(0, limit).map((s, i) => {
            const key = `${node?.id}-${i}`;
            const isOpen = open[key] ?? i === 0;
            return (
              <div className={`sec${isOpen ? " open" : ""}`} key={key}>
                <div className="hd" onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}>
                  <span className="no">{String(i + 1).padStart(2, "0")}</span>
                  <b style={{ fontWeight: 600 }}>{s.heading}</b>
                  <span className="arrow" style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 11, transform: isOpen ? "rotate(90deg)" : "none" }}>▶</span>
                </div>
                <div className="bd" style={{ display: isOpen ? "block" : "none", padding: "0 18px 14px 66px", fontSize: 13.5, lineHeight: 1.9 }}>
                  {s.body}
                </div>
              </div>
            );
          })}
          {plainSections.length > limit && (
            <p className="mut" style={{ padding: "8px 18px 0 66px", fontSize: 11.5 }}>
              还有 {plainSections.length - limit} 段未展开 —— 切换到更深的讲解模式查看。
            </p>
          )}
        </div>
      </div>

      <div className="fable open">
        <div className="hd">
          <span className="tag">FABLE</span>
          <b>寓言卡</b>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge b-ai">AI 生成 · 四段式</span>
            <button className="btn sm ghost" type="button" disabled={fableBusy} onClick={genFable}>
              {fableBusy ? "生成中…" : fable ? "↻ 重新生成" : "生成寓言卡"}
            </button>
          </span>
        </div>
        <div className="body">
          {fableErr && <p style={{ color: "var(--mark-red)", fontSize: 12.5 }}>{fableErr}</p>}
          {!fable && !fableErr && (
            <p className="mut" style={{ fontSize: 12.5 }}>
              寓言卡只在抽象、易混淆、易被追问的机制上生成。点击右上角生成（需要配置 API Key；不会伪造故事）。
            </p>
          )}
          {fable && (
            <>
              <blockquote>{fable.story}</blockquote>
              <div style={{ marginTop: 8 }}><b>揭晓：</b>{fable.reveal}</div>
              <table className="cmp" style={{ borderColor: "#E7D9AE" }}>
                <tbody>
                  <tr><th>故事里的东西</th><th>对应的概念</th></tr>
                  {fable.mapping.map((m, i) => (
                    <tr key={i}><td>{m.story_element}</td><td>{m.concept}</td></tr>
                  ))}
                </tbody>
              </table>
              <div><b>回到项目：</b>{fable.backToProject}</div>
              <div style={{ color: "var(--mark-red)", fontSize: 12.5, marginTop: 6 }}>
                ⚠ 类比不成立之处：{fable.limitations.join("；")}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 升级 2：影响探针 */}
      {node?.evidence_note && parseEvPath(node.evidence_note) && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="hd">
            <span className="file-no">PROBE</span><b>试试看：如果删掉这行代码会怎样？</b>
            <span className="right"><button className="btn sm" type="button" style={{ background: "var(--evidence-amber)", borderColor: "var(--evidence-amber)" }} disabled={probeBusy} onClick={runProbe}>
              {probeBusy ? "探针运行中…" : "⚡ 影响探针"}
            </button></span>
          </div>
          {probe && (
            <div className="bd" style={{ fontSize: 13, lineHeight: 1.9 }}>
              <div className="grid2">
                <div>
                  <div className="mut" style={{ fontSize: 11, marginBottom: 4 }}>删掉之前</div>
                  <pre className="mono" style={{ background: "#F5F8FC", padding: 10, borderRadius: 6, fontSize: 11.5, whiteSpace: "pre-wrap" }}>{probe.diff?.before?.split(String.fromCharCode(10))?.slice(Math.max(0, probe.targetLine - 3), probe.targetLine + 2)?.join(String.fromCharCode(10))}</pre>
                </div>
                <div>
                  <div className="mut" style={{ fontSize: 11, marginBottom: 4 }}>删掉之后（<span style={{ color: "var(--mark-red)" }}>{probe.targetLine} 行被注释</span>）</div>
                  <pre className="mono" style={{ background: "#FFF5F5", padding: 10, borderRadius: 6, fontSize: 11.5, whiteSpace: "pre-wrap", border: "1px solid var(--mark-red)" }}>{probe.diff?.after?.split(String.fromCharCode(10))?.slice(Math.max(0, probe.targetLine - 3), probe.targetLine + 2)?.join(String.fromCharCode(10))}</pre>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#FFF9E6", borderRadius: 6, fontSize: 13, border: "1px solid var(--evidence-amber)" }}>
                💡 {probe.insight}
              </div>
              {probe.verify?.status !== "not_run" && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  验证结果：<span className={`badge ${probe.verify?.status === "passed" ? "b-green" : "b-stale"}`}>{probe.verify?.status}</span>
                  {probe.verify?.output && <pre className="mono" style={{ background: "#0F1B33", color: "#D7E1F5", padding: 8, borderRadius: 6, fontSize: 10.5, marginTop: 4, overflow: "auto", maxHeight: 120 }}>{probe.verify.output}</pre>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 升级 3：换一种写法 */}
      {node?.evidence_note && parseEvPath(node.evidence_note) && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="hd">
            <span className="file-no">ALT</span><b>换一种写法？——设计决策对比</b>
            <span className="right"><button className="btn sm" type="button" disabled={altsBusy} onClick={genAlts}>
              {altsBusy ? "生成中…" : alts ? "↻ 重新生成" : "生成替代方案"}
            </button></span>
          </div>
          {alts && (
            <div className="bd" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
              {alts.alternatives?.map((a: any, i: number) => (
                <div key={i} style={{ border: `1px solid ${a.chosen ? "var(--pass-green)" : "var(--grid)"}`, borderRadius: 8, padding: 12, marginBottom: 10, background: a.chosen ? "#F8FBF8" : "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <b>{a.name}</b>
                    {a.chosen && <span className="badge b-green">当前方案</span>}
                  </div>
                  <pre className="mono" style={{ background: "#0F1B33", color: "#D7E1F5", padding: 10, borderRadius: 6, fontSize: 11, overflow: "auto", whiteSpace: "pre-wrap" }}>{a.code}</pre>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                    <div><b style={{ color: "var(--pass-green)", fontSize: 11 }}>优点</b>{a.pros?.map((p: string, k: number) => <div key={k} style={{ fontSize: 11.5 }}>✓ {p}</div>)}</div>
                    <div><b style={{ color: "var(--mark-red)", fontSize: 11 }}>缺点</b>{a.cons?.map((c: string, k: number) => <div key={k} style={{ fontSize: 11.5 }}>✗ {c}</div>)}</div>
                  </div>
                </div>
              ))}
              {alts.insight && <div style={{ padding: "8px 12px", background: "#EEF1F8", borderRadius: 6, fontSize: 12.5, marginTop: 8 }}><b>💡：</b>{alts.insight}</div>}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">NODE-E3</span><b>我是否真的理解了？（掌握判定与复习调度分离）</b></div>
        <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
          <div className="mut" style={{ marginBottom: 8 }}>
            先合上讲义，用自己的话解释一遍，再自评。看答案后说"懂了"不算独立掌握。
          </div>
          <button className="btn sm" type="button" onClick={() => mark("good")} style={{ background: "var(--pass-green)", borderColor: "var(--pass-green)" }}>
            我能独立讲清楚 → 记掌握
          </button>
          <button className="btn sm ghost" type="button" style={{ marginLeft: 8 }} onClick={() => mark("again")}>
            还要再看 → 进复习队列
          </button>
          {masteryMsg && <div style={{ marginTop: 8, color: "var(--evidence-amber)" }}>{masteryMsg}</div>}
          <div style={{ marginTop: 10 }}>
            <Link href={`/project/${id}/kb`} style={{ color: "#3D4FA1", textDecoration: "underline" }}>在知识库中查看 →</Link>
            <span className="mut">　该知识点已归入知识库，到期会自动回到复习队列。</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseEvidencePath(note: string | null): string | null {
  const m = (note ?? "").match(/([\w./-]+\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue))(?::\d+)?/);
  return m ? m[1] : null;
}
function parseEvidenceLine(note: string | null): number | null {
  const m = (note ?? "").match(/\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue):(\d+)/);
  return m ? Number(m[1]) : null;
}
