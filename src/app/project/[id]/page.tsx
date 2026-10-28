"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Data = {
  project: { id: number; name: string; slug: string; stack: string; source_type: string; root_path: string; mission: string | null; defense_date: string | null };
  stats: { parse_mode: string; n: number }[];
  runs: { id: number; version: string; kind: string; status: string; stage: string | null; step: string | null; progress_note: string | null; recovery_count: number; updated_at: string }[];
  insights: { kind: string; title: string; content: string | null; evidence_note: string | null }[];
  coverage: { dim: string; target_n: number; done_n: number; failed_n: number; skipped_n: number; note: string | null }[];
  openQuestions: { question: string; why: string | null; next_check: string | null }[];
  counts: Record<string, number>;
  llmCache: { entries: number; hasKey: boolean };
};

const DIMS: Record<string, string> = {
  files: "文件解析",
  symbols: "符号识别",
  references: "引用关系",
  flows: "业务流程",
  external_deps: "外部依赖",
  runtime: "运行验证",
};

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [missionEdit, setMissionEdit] = useState<string | null>(null);
  const [dateEdit, setDateEdit] = useState<string | null>(null);
  const [missionSaved, setMissionSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) {
      setErr((await res.json()).error ?? "加载失败");
      return;
    }
    setD(await res.json());
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <p className="sub" style={{ color: "var(--mark-red)" }}>{err}</p>;
  if (!d) return <p className="sub">加载中…</p>;

  const stack = (() => {
    try {
      return JSON.parse(d.project.stack || "{}");
    } catch {
      return {};
    }
  })() as { languages?: string[]; frameworks?: string[]; packageManagers?: string[] };
  const lastRun = d.runs[0];
  const analysisDone = lastRun?.status === "completed";
  const coverageFull = d.coverage.length > 0;
  const supported = d.counts.claims > 0;

  return (
    <div>
      <div className="crumb">OVERVIEW / {d.project.slug}</div>
      <h1 className="t">{d.project.name}</h1>
      <p className="sub">
        {d.project.source_type === "zip" ? "zip 导入（便携）" : "本地路径导入"} · 根目录{" "}
        <span className="mono" style={{ fontSize: 11 }}>{d.project.root_path}</span>
      </p>

      <div className="grid3" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="hd"><span className="file-no">OV-01</span><b>技术栈</b></div>
          <div className="bd" style={{ fontSize: 13, lineHeight: 2.2 }}>
            {[...(stack.languages ?? []), ...(stack.frameworks ?? [])].map((t) => (
              <span key={t} className="badge b-src" style={{ marginRight: 6 }}>{t}</span>
            ))}
            {(stack.languages ?? []).length === 0 && <span className="mut">未识别到 manifest</span>}
            <div className="mut" style={{ fontSize: 11 }}>来自 package.json / pom.xml / requirements.txt / lockfile</div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">OV-02</span><b>解析方式（诚实口径）</b></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            {d.stats.map((s) => (
              <div className="st" key={s.parse_mode}>
                <span>{s.parse_mode}</span>
                <span>{s.n}</span>
              </div>
            ))}
            {d.stats.length === 0 && <span className="mut">尚无文件记录</span>}
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">OV-03</span><b>三个独立状态</b></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            <div className="st">
              <span>分析任务完成</span>
              <span className={`badge ${analysisDone ? "b-green" : "b-none"}`}>{analysisDone ? "是" : "否"}</span>
            </div>
            <div className="st">
              <span>覆盖充分</span>
              <span className={`badge ${coverageFull ? "b-infer" : "b-none"}`}>{coverageFull ? "有覆盖数据" : "未生成"}</span>
            </div>
            <div className="st">
              <span>结论有证据支撑</span>
              <span className={`badge ${supported ? "b-run" : "b-none"}`}>{d.counts.claims} 条结论</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="hd"><span className="file-no">OV-04</span><b>六维覆盖报告</b></div>
          <div className="bd cov">
            {d.coverage.length === 0 && (
              <p className="mut" style={{ fontSize: 12.5 }}>
                尚无覆盖统计。运行一次「完整分析（map）」后生成。
              </p>
            )}
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
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">OV-05</span><b>评委视角体检（疑似，非定论）</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
            {d.insights.filter((i) => i.kind === "health" || i.kind === "risk").slice(0, 6).map((i, k) => (
              <div key={k}>
                · <b>{i.title}</b>
                {i.evidence_note && !i.title.includes(i.evidence_note) && (
                  <span className="mono mut" style={{ fontSize: 11 }}>　{i.evidence_note}</span>
                )}
              </div>
            ))}
            {d.insights.filter((i) => i.kind === "health" || i.kind === "risk").length === 0 && (
              <span className="mut">尚无体检发现（运行 map 后生成）。</span>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd">
          <span className="file-no">OV-10</span><b>答辩任务书（讲解/出题/冲刺的锚点）</b>
          <span className="right">
            <button className="btn sm" type="button" onClick={async () => {
              const res = await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mission: missionEdit ?? "", defenseDate: dateEdit ?? "" }),
              });
              if (res.ok) { setMissionSaved(true); void load(); setTimeout(() => setMissionSaved(false), 2000); }
            }}>保存任务书</button>
            {missionSaved && <span className="badge b-green">已保存</span>}
          </span>
        </div>
        <div className="bd" style={{ fontSize: 12.5 }}>
          <div className="row2">
            <div className="field" style={{ margin: 0 }}>
              <label>答辩日期</label>
              <input type="text" className="mono" value={dateEdit ?? ""} onChange={(e) => setDateEdit(e.target.value)} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>评分依据（自由格式：评委追问 / 你最怕的）</label>
              <input type="text" value={missionEdit ?? ""} onChange={(e) => setMissionEdit(e.target.value)} />
            </div>
          </div>
          <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>
            保存后：答辩模拟的出题与评分会引用任务书；能力雷达按日期生成冲刺计划。
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">OV-06</span><b>开放问题（证据缺口）</b></div>
        <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
          {d.openQuestions.slice(0, 8).map((q, k) => (
            <div key={k}>
              ❓ <b>{q.question}</b>
              {q.next_check && <span className="mut">（下一步核查：{q.next_check}）</span>}
            </div>
          ))}
          {d.openQuestions.length === 0 && <span className="mut">无开放问题。</span>}
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="hd"><span className="file-no">OV-07</span><b>资产生成情况</b></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            {[
              ["知识节点", d.counts.nodes],
              ["业务流程", d.counts.flows],
              ["术语", d.counts.terms],
              ["练习/挑战", d.counts.practice],
              ["证据", d.counts.evidence],
              ["结论", d.counts.claims],
            ].map(([k, v]) => (
              <div className="st" key={k as string}><span>{k}</span><span>{v as number}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">OV-08</span><b>LLM 花费与缓存</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.1 }}>
            <div>API Key：{d.llmCache.hasKey ? <span className="badge b-green">已配置</span> : <span className="badge b-stale">未配置（将写入开放问题）</span>}</div>
            <div>缓存条目：<b>{d.llmCache.entries}</b></div>
            <div className="mut" style={{ fontSize: 11 }}>相同输入命中缓存零 token；知识点是落库实体，浏览不触发生成。</div>
            <Link className="btn sm ghost" href={`/project/${id}/settings`}>去设置</Link>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">OV-09</span><b>导出（P5）</b></div>
          <div className="bd" style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 8 }}>
            <a className="btn sm" href={`/api/projects/${id}/export/obsidian`}>导出 Obsidian 双链 wiki (.zip)</a>
            <a className="btn sm ghost" href={`/api/projects/${id}/export/cheatsheet`}>导出答辩速查包 (.html)</a>
            <div className="mut" style={{ fontSize: 11 }}>速查包含流程卡/知识点/术语/疑似追问，可打印。</div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">OV-99</span><b>最近任务</b></div>
          <div className="bd" style={{ fontSize: 12 }}>
            {d.runs.slice(0, 4).map((r) => (
              <div key={r.id} className="mono" style={{ marginBottom: 4 }}>
                {r.version} · <b>{r.status}</b> · {r.stage ?? "-"} {r.step ?? ""}
                {r.status === "running" && <span className="badge b-ai" style={{ marginLeft: 6 }}>运行中</span>}
              </div>
            ))}
            {d.runs.length === 0 && <span className="mut">尚无任务</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
