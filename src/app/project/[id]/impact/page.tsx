"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Impact = {
  snapshot: { version: string; kind: string; updatedAt: string; files: number } | null;
  evidence: { current: number; shifted: number; stale: number };
  claims: { draft: number; supported: number; reviewed: number; flagged: number; superseded: number };
  staleEvidence: { id: number; file_path: string; start_line: number | null; note: string | null; freshness: string }[];
  flaggedClaims: { id: number; content: string; derivation: string; review_state: string }[];
  changeQuestions: { question: string; why: string | null; next_check: string | null; status: string }[];
};

type Run = { changedFiles: string[]; staleEvidence: number; flaggedClaims: number; openQuestions: number };

export default function ImpactPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Impact | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Run | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/impact`);
    if (res.ok) setD(await res.json());
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function check() {
    setBusy(true);
    setErr(null);
    setResult(null);
    const res = await fetch(`/api/projects/${id}/invalidate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setErr(data.error ?? "检查失败");
    else setResult(data);
    setBusy(false);
    void load();
  }

  if (!d) return <p className="sub">加载中…</p>;

  const totalEv = d.evidence.current + d.evidence.shifted + d.evidence.stale;
  const totalCl = d.claims.draft + d.claims.supported + d.claims.reviewed + d.claims.flagged + d.claims.superseded;

  return (
    <div>
      <div className="crumb">IMPACT / 变更影响 / 失效传播</div>
      <h1 className="t">变更影响</h1>
      <p className="sub">
        源码变了，旧结论就不能继续冒充当前事实。检查会对比当前文件哈希与最新快照，把受影响的证据与结论标为「待复核」。
      </p>

      <div className="toolrow">
        <button className="btn" type="button" disabled={busy} onClick={check}>
          {busy ? "对比中…" : "检查变更"}
        </button>
        <span className="mut" style={{ fontSize: 11.5 }}>
          {d.snapshot
            ? `基准快照：${d.snapshot.version}（${d.snapshot.kind}）· ${d.snapshot.files} 个文件 · ${d.snapshot.updatedAt}`
            : "尚无快照：先运行一次 scan/map"}
        </span>
      </div>
      {err && <p style={{ color: "var(--mark-red)", fontSize: 12.5 }}>{err}</p>}
      {result && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="hd"><span className="file-no">IMPACT</span><b>本次检查结果</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
            {result.changedFiles.length === 0 ? (
              <span style={{ color: "var(--pass-green)" }}>✓ 没有检测到文件变化：快照与当前工作区一致。</span>
            ) : (
              <>
                <div>变化文件 <b>{result.changedFiles.length}</b> 个 · 失效证据 <b>{result.staleEvidence}</b> 条 · 待复核结论 <b>{result.flaggedClaims}</b> 条 · 新增开放问题 <b>{result.openQuestions}</b></div>
                <div className="mono" style={{ fontSize: 11.5, marginTop: 6 }}>
                  {result.changedFiles.slice(0, 20).map((f) => (
                    <Link key={f} href={`/project/${id}/code?path=${encodeURIComponent(f)}`} style={{ marginRight: 10 }}>
                      {f}
                    </Link>
                  ))}
                </div>
              </>
            )}
            <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>
              MVP 采用保守策略：哈希变化即标失效，不假装知道变化影响（AST 差异对比属后续）。
            </div>
          </div>
        </div>
      )}

      <div className="grid3">
        <div className="card">
          <div className="hd"><span className="file-no">IM-01</span><b>证据新鲜度</b></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            <div className="st"><span><span className="badge b-none">current</span> 当前一致</span><span>{d.evidence.current}/{totalEv}</span></div>
            <div className="st"><span><span className="badge b-infer">shifted</span> 行号偏移</span><span>{d.evidence.shifted}</span></div>
            <div className="st"><span><span className="badge b-stale">stale</span> 待复核</span><span>{d.evidence.stale}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">IM-02</span><b>结论核查状态</b></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            <div className="st"><span>supported 有证据支撑</span><span>{d.claims.supported}</span></div>
            <div className="st"><span>draft 待核查</span><span>{d.claims.draft}</span></div>
            <div className="st"><span><span className="badge b-stale">flagged</span> 发现问题</span><span>{d.claims.flagged}</span></div>
            <div className="st"><span>superseded 被替代</span><span>{d.claims.superseded}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">IM-03</span><b>传播说明</b></div>
          <div className="bd" style={{ fontSize: 12, lineHeight: 1.95 }}>
            变化文件 → 证据 stale → 引用它的结论 flagged → 相关业务流程/知识点/答辩题需要复核。
            <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>
              共 {totalCl} 条结论在管；历史版本保留，不冒充当前事实。
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">IM-04</span><b>待复核证据（{d.staleEvidence.length}）</b></div>
        <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
          {d.staleEvidence.length === 0 && <span className="mut">没有失效证据。</span>}
          {d.staleEvidence.map((e) => (
            <div key={e.id}>
              <span className={`badge ${e.freshness === "stale" ? "b-stale" : "b-infer"}`}>{e.freshness}</span>{" "}
              <Link href={`/project/${id}/code?path=${encodeURIComponent(e.file_path)}${e.start_line ? `&line=${e.start_line}` : ""}`} className="mono">
                {e.file_path}:{e.start_line ?? ""}
              </Link>{" "}
              <span className="mut">{e.note ?? ""}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">IM-05</span><b>待复核结论（{d.flaggedClaims.length}）</b></div>
        <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
          {d.flaggedClaims.length === 0 && <span className="mut">没有 flagged 结论。</span>}
          {d.flaggedClaims.map((c) => (
            <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px dashed var(--grid)" }}>
              <span className="badge b-stale">{c.review_state}</span>{" "}
              <span>{c.content}</span>
              <span className="mut mono" style={{ fontSize: 11 }}>（{c.derivation}）</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">IM-06</span><b>相关开放问题</b></div>
        <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
          {d.changeQuestions.length === 0 && <span className="mut">没有与变化/失败相关的开放问题。</span>}
          {d.changeQuestions.map((q, i) => (
            <div key={i}>
              ❓ <b>{q.question}</b>
              {q.why && <span className="mut">（{q.why}）</span>}
              {q.next_check && <div className="mut" style={{ fontSize: 11 }}>下一步：{q.next_check}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
