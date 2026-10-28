"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Run = { id: number; version: string; kind: string; status: string; stage: string | null; step: string | null; progress_note: string | null; recovery_count: number; updated_at: string };
type Stats = { calls: number; hitRate: number; tokensTotal: number; cacheEntries: number; budget: number };
type Info = {
  runs: Run[];
  counts: Record<string, number>;
  llmCache: { entries: number; hasKey: boolean };
  openQuestions: { question: string; why: string | null; next_check: string | null }[];
};

const STAGES = [
  ["walk", "扫描文件清单"],
  ["scan", "文件解析（parse_mode）"],
  ["lockfile", "依赖解析（lockfile）"],
  ["symbols", "符号抽取（ts-morph）"],
  ["evidence", "证据落库（端点/路由）"],
  ["edges", "静态引用图（IMPORTS/CONTAINS）"],
  ["audit", "全库体检"],
  ["flows", "业务流程追踪"],
  ["claims", "结论层（证据支撑）"],
  ["architecture", "架构总览（LLM）"],
  ["module", "模块深挖（LLM）"],
  ["nodes", "知识点生成（LLM）"],
  ["terms", "术语与前置（LLM）"],
  ["practice", "练习与挑战（LLM）"],
  ["coverage", "覆盖统计"],
  ["done", "完成"],
];

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setInfo(await res.json());
  }, [id]);

  useEffect(() => {
    void load();
    const loadStats = () => fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
    void loadStats();
    const t = setInterval(() => { void load(); void loadStats(); }, 1500);
    return () => clearInterval(t);
  }, [load]);

  async function start(kind: "scan" | "map") {
    setNotice(null);
    const res = await fetch(`/api/projects/${id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = await res.json();
    setNotice(res.ok ? `已启动 ${kind} 任务（run ${data.runId}）` : (data.error ?? "启动失败"));
    void load();
  }

  if (!info) return <p className="sub">加载中…</p>;

  const running = info.runs.find((r) => r.status === "running" || r.status === "queued");
  const lastMap = info.runs.find((r) => r.kind === "map");
  const stageIdx = lastMap?.stage ? STAGES.findIndex(([k]) => k === lastMap.stage) : -1;

  return (
    <div>
      <div className="crumb">MAP / AI 分析现场 / worker 子进程 · 断点续跑 · prompt 缓存</div>
      <h1 className="t">AI 分析现场</h1>
      <p className="sub">
        LLM 只组织解释、不产生事实：每个阶段的产物都即时落库并带证据。这里把它的作业过程摊开。
      </p>

      <div className="toolrow">
        <button className="btn" type="button" onClick={() => start("scan")}>重新扫描（scan）</button>
        <button className="btn" type="button" onClick={() => start("map")} style={{ background: "var(--mark-red)", borderColor: "var(--mark-red)" }}>
          完整分析（map）
        </button>
        {running && <span className="badge b-ai">任务运行中：{running.version} · {running.stage} {running.step}</span>}
        {notice && <span className="mut" style={{ fontSize: 12 }}>{notice}</span>}
      </div>

      <div className="grid3">
        <div className="card">
          <div className="hd"><span className="file-no">AI-01</span><b>模型与授权</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.1 }}>
            API Key：{info.llmCache.hasKey ? <span className="badge b-green">已配置</span> : <span className="badge b-stale">未配置</span>}
            <div>缓存条目：<b>{info.llmCache.entries}</b>{stats && <> · 命中率 <b>{Math.round(stats.hitRate * 100)}%</b></>}</div>
            {stats && (
              <div>
                已用 tokens：<b>{stats.tokensTotal.toLocaleString()}</b>
                {stats.budget > 0 ? <> / 预算 {stats.budget.toLocaleString()}（{Math.min(100, Math.round((stats.tokensTotal / stats.budget) * 100))}%）</> : <> · 预算不限</>}
              </div>
            )}
            <div className="mut" style={{ fontSize: 11 }}>
              {info.llmCache.hasKey
                ? "相同输入命中缓存零 token；未命中的阶段会真实调用模型。"
                : "未配 Key 时 LLM 阶段降级：写开放问题并保留静态结论，不伪造内容。"}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">AI-02</span><b>产出统计</b></div>
          <div className="bd state3" style={{ fontSize: 12.5 }}>
            {[["证据", "evidence"], ["结论", "claims"], ["业务流程", "flows"], ["知识节点", "nodes"], ["术语", "terms"], ["练习", "practice"]].map(([label, k]) => (
              <div className="st" key={k}><span>{label}</span><span>{info.counts[k] ?? 0}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">AI-03</span><b>断点与恢复</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.1 }}>
            {info.runs.slice(0, 5).map((r) => (
              <div key={r.id} className="mono" style={{ fontSize: 11.5 }}>
                {r.version} · {r.status} · {r.stage ?? "-"} {r.step ?? ""} · 恢复 {r.recovery_count} 次
              </div>
            ))}
            <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>
              强杀 worker 后，心跳超时自动重排并从 file 检查点续跑（最多 3 次）。
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">AI-04</span><b>流水线</b>
          <span className="right mut" style={{ fontSize: 11 }}>
            {lastMap ? `最近 map：${lastMap.version} · ${lastMap.status} · ${lastMap.progress_note ?? ""}` : "尚无 map 任务"}
          </span>
        </div>
        <div className="bd">
          {STAGES.map(([k, label], i) => {
            const done = stageIdx > i || lastMap?.status === "completed";
            const cur = stageIdx === i && lastMap?.status !== "completed";
            return (
              <div key={k} className="stage">
                <span className={`ic ${done ? "done" : cur ? "run" : "q"}`}>{done ? "✓" : cur ? "⟳" : "·"}</span>
                <div>
                  <b style={{ fontWeight: done || cur ? 600 : 400, color: done || cur ? undefined : "var(--muted)" }}>{label}</b>
                  {cur && <span className="badge b-ai" style={{ marginLeft: 6 }}>运行中</span>}
                </div>
                <div className="bar" style={{ height: 6, background: "#EDF1F7" }}>
                  <i style={{ width: done ? "100%" : cur ? "60%" : "0%" }} />
                </div>
                <div className="tok">{lastMap?.step && cur ? lastMap.step : ""}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">AI-05</span><b>开放问题（证据不足时的诚实出口）</b></div>
        <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
          {info.openQuestions.slice(0, 10).map((q, i) => (
            <div key={i}>❓ <b>{q.question}</b>{q.next_check && <span className="mut">（下一步：{q.next_check}）</span>}</div>
          ))}
          {info.openQuestions.length === 0 && <span className="mut">暂无——没有证据缺口，或还没跑过 map。</span>}
        </div>
      </div>
    </div>
  );
}
