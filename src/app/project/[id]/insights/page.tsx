"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Insight = { kind: string; title: string; content: string | null; evidence_note: string | null };
type History = { commit_hash: string | null; author: string | null; committed_at: string | null; subject: string | null; files: string | null };
type Data = {
  insights: Insight[];
  history: History[];
  coverage: { dim: string; target_n: number; done_n: number; failed_n: number; skipped_n: number; note: string | null }[];
  counts: Record<string, number>;
};

const KIND_LABEL: Record<string, { label: string; cls: string }> = {
  health: { label: "体检 · 疑似问题", cls: "b-stale" },
  risk: { label: "风险", cls: "b-stale" },
  architecture: { label: "架构总览", cls: "b-infer" },
  module: { label: "模块深挖", cls: "b-src" },
};

const DIMS: Record<string, string> = {
  files: "文件解析",
  symbols: "符号识别",
  references: "引用关系",
  flows: "业务流程",
  external_deps: "外部依赖",
  runtime: "运行验证",
};

export default function InsightsPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setD(await res.json());
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!d) return <p className="sub">加载中…</p>;

  const health = d.insights.filter((i) => i.kind === "health" || i.kind === "risk");
  const arch = d.insights.filter((i) => i.kind === "architecture");
  const modules = d.insights.filter((i) => i.kind === "module");

  return (
    <div>
      <div className="crumb">INSIGHTS / 体检与演进 / 评委视角 · git 考古</div>
      <h1 className="t">体检与演进</h1>
      <p className="sub">
        评委最可能追问的代码瑕疵（均标「疑似」，非定论），以及这个项目是怎么一步步长出来的。
      </p>

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="hd">
            <span className="file-no">IN-01</span><b>评委视角体检</b>
            <span className="right"><span className="badge b-infer">疑似 · 不是确定缺陷</span></span>
          </div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
            {health.length === 0 && <span className="mut">暂无体检发现（运行 map 后生成）。</span>}
            {health.map((h, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px dashed var(--grid)" }}>
                <b>{h.title}</b>
                {h.evidence_note && (
                  <>
                    {" "}
                    <Link href={`/project/${id}/code?path=${encodeURIComponent(pathOf(h.evidence_note) ?? "")}${lineOf(h.evidence_note) ? `&line=${lineOf(h.evidence_note)}` : ""}`} className="mono" style={{ fontSize: 11 }}>
                      {h.evidence_note}
                    </Link>
                  </>
                )}
                {h.content && <div className="mut" style={{ fontSize: 11.5 }}>{h.content}</div>}
              </div>
            ))}
            <div className="mut" style={{ fontSize: 11, marginTop: 8 }}>
              提示：这些发现会作为「疑似」题源进入答辩模拟，不当作确定缺陷。
            </div>
          </div>
        </div>

        <div className="card">
          <div className="hd"><span className="file-no">IN-02</span><b>造物过程（git 演进）</b>
            <span className="right mut" style={{ fontSize: 11 }}>{d.history.length} 条提交</span>
          </div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 1.9, maxHeight: 460, overflow: "auto" }}>
            {d.history.length === 0 && <span className="mut">没有 git 历史（非 git 项目或未跑 map）。</span>}
            {d.history.map((h, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px dashed var(--grid)" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--evidence-amber)" }}>
                  {h.commit_hash?.slice(0, 7)}
                </span>{" "}
                <span>{h.subject}</span>
                <div className="mut" style={{ fontSize: 11 }}>
                  {h.author} · {h.committed_at} {h.files ? `· ${h.files}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="hd"><span className="file-no">IN-03</span><b>架构与模块（LLM 组织，挂证据）</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 1.95 }}>
            {[...arch, ...modules].length === 0 && <span className="mut">暂无（运行 map 后生成）。</span>}
            {[...arch, ...modules].map((m, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: "1px dashed var(--grid)" }}>
                <span className={`badge ${KIND_LABEL[m.kind]?.cls ?? "b-infer"}`}>{KIND_LABEL[m.kind]?.label ?? m.kind}</span>{" "}
                <b>{m.title}</b>
                {m.content && <div className="mut" style={{ fontSize: 11.5 }}>{m.content}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="hd"><span className="file-no">IN-04</span><b>六维覆盖（诚实口径）</b></div>
          <div className="bd cov">
            {d.coverage.length === 0 && <span className="mut" style={{ fontSize: 12.5 }}>尚无覆盖统计。</span>}
            {d.coverage.map((c) => {
              const pct = c.target_n > 0 ? Math.round((c.done_n / c.target_n) * 100) : 0;
              return (
                <div className="row" key={c.dim}>
                  <span>{DIMS[c.dim] ?? c.dim}</span>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <span className="mut">{c.done_n}/{c.target_n}</span>
                </div>
              );
            })}
            <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>
              选料（PageRank）不改变覆盖口径——没分析到的文件如实计入未覆盖。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pathOf(note: string | null): string | null {
  const m = (note ?? "").match(/([\w./-]+\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue))(?::\d+)?/);
  return m ? m[1] : null;
}
function lineOf(note: string | null): number | null {
  const m = (note ?? "").match(/\.(?:ts|tsx|js|jsx|py|java|go|sql|json|md|vue):(\d+)/);
  return m ? Number(m[1]) : null;
}
