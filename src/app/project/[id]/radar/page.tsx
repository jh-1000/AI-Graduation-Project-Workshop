"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type NodeRow = { id: number; slug: string; title: string; kind: string };
type MasteryItem = { node_id: number; status: string; due: string; reps: number; title: string; slug: string; kind: string };
type AttemptStat = { kind: string; total: number; passed: number; independentCount: number };
type ProjectInfo = { mission: string | null; defense_date: string | null; name: string };

const KIND_LABEL: Record<string, string> = {
  module: "模块",
  flow: "业务功能",
  concept: "核心概念",
  api: "执行机制",
  data: "数据",
};

export default function RadarPage() {
  const { id } = useParams<{ id: string }>();
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [mastery, setMastery] = useState<MasteryItem[]>([]);
  const [due, setDue] = useState<{ nodeId: number; title: string; slug: string; kind: string }[]>([]);
  const [attemptStats, setAttemptStats] = useState<AttemptStat[]>([]);
  const [proj, setProj] = useState<ProjectInfo | null>(null);

  const load = useCallback(async () => {
    const [n, m, a, info] = await Promise.all([
      fetch(`/api/projects/${id}/nodes`).then((r) => r.json()),
      fetch(`/api/projects/${id}/mastery`).then((r) => r.json()),
      fetch(`/api/projects/${id}/attempts`).then((r) => r.json()),
      fetch(`/api/projects/${id}`).then((r) => r.json()),
    ]);
    setNodes(n.nodes ?? []);
    setMastery(m.items ?? []);
    setDue(m.due ?? []);
    setAttemptStats(a.byKind ?? []);
    setProj(info.project ?? null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const axes = useMemo(() => {
    const kinds = Array.from(new Set(nodes.map((n) => n.kind)));
    return kinds.map((k) => {
      const list = nodes.filter((n) => n.kind === k);
      const m = list.filter((n) => mastery.find((x) => x.node_id === n.id)?.status === "mastered").length;
      return { kind: k, label: KIND_LABEL[k] ?? k, total: list.length, mastered: m, ratio: list.length ? m / list.length : 0 };
    });
  }, [nodes, mastery]);

  const learned = mastery.filter((m) => m.status !== "unlearned").length;
  const next = useMemo(() => {
    const notDone = nodes.find((n) => !mastery.find((m) => m.node_id === n.id && m.status === "mastered"));
    return notDone ?? null;
  }, [nodes, mastery]);

  return (
    <div>
      <div className="crumb">RADAR / 能力雷达 / 掌握判定与复习调度分离</div>
      <h1 className="t">能力雷达</h1>
      <p className="sub">
        没有单一分数，只展示有证据的部分。每一条掌握都来自你的独立自评（配提示/看答案的记录会降权——P3 接入练习记录后细化）。
      </p>

      <div className="card" style={{ marginTop: 18, padding: 24 }}>
        <div style={{ display: "flex", gap: 30, alignItems: "center", flexWrap: "wrap" }}>
          <Radar axes={axes} />
          <div style={{ flex: 1, minWidth: 260 }}>
            {axes.length === 0 && <p className="mut" style={{ fontSize: 12.5 }}>尚无知识点，无法形成掌握分布。</p>}
            {axes.map((a) => (
              <div key={a.kind} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: 280, borderBottom: "1px dashed var(--grid)", padding: "7px 0", fontSize: 12.5 }}>
                <span>{a.label}</span>
                <span className="mut">{a.mastered}/{a.total}</span>
                <span className={`badge ${a.ratio === 1 ? "b-run" : a.mastered > 0 ? "b-infer" : "b-none"}`}>
                  {a.ratio === 1 ? "已验证掌握" : a.mastered > 0 ? "练习中" : "未学习"}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 12 }} className="mut">
              已学习 {learned} 条 · 到期复习 {due.length} 张
            </div>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="hd"><span className="file-no">RD-01</span><b>下一个该学什么（最近发展区）</b></div>
          <div className="bd" style={{ fontSize: 13, lineHeight: 2 }}>
            {next ? (
              <>
                建议 → <b>{next.title}</b>（{KIND_LABEL[next.kind] ?? next.kind}）—— 尚未掌握的高优先级知识点。
                <div style={{ marginTop: 8 }}>
                  <Link className="btn sm" href={`/project/${id}/node?slug=${encodeURIComponent(next.slug)}`}>开始学习 →</Link>
                </div>
              </>
            ) : (
              <span className="mut">所有知识点都已标记掌握。去答辩模拟做一次终局复述检验，或在知识库等待到期复习。</span>
            )}
          </div>
        </div>
        <div className="card">
          <div className="hd"><span className="file-no">RD-02</span><b>到期复习</b></div>
          <div className="bd" style={{ fontSize: 12.5, lineHeight: 2 }}>
            {due.length === 0 ? <span className="mut">今天没有到期卡片。</span> : due.slice(0, 8).map((d) => (
              <div key={d.nodeId}>· <Link href={`/project/${id}/node?slug=${encodeURIComponent(d.slug)}`} style={{ color: "#3D4FA1" }}>{d.title}</Link></div>
            ))}
            <div className="toolrow">
              <Link className="btn sm ghost" href={`/project/${id}/kb`}>去知识库复习 →</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd">
          <span className="file-no">RD-02</span><b>答辩冲刺</b>
          <span className="right mut" style={{ fontSize: 11 }}>
            {proj?.defense_date ? `答辩日 ${proj.defense_date}` : "未填答辩日期（总览页任务书）"}
          </span>
        </div>
        <div className="bd sprint">
          {due.length > 0 && (
            <div className="it"><span className="tag">今日到期</span><span>{due.length} 张复习卡：{due.slice(0, 3).map((x) => x.title).join("、")}{due.length > 3 ? " 等" : ""}</span></div>
          )}
          {attemptStats.filter((a) => a.kind === "locate" && a.passed < a.total).map((a) => (
            <div className="it" key={a.kind}><span className="tag">必练定位</span><span>定位通过 {a.passed}/{a.total} —— 去挑战页重练未命中的题</span></div>
          ))}
          {proj?.mission && <div className="it"><span className="tag">任务书</span><span>{proj.mission}</span></div>}
          <div className="it"><span className="tag">每日</span><span>知识库到期复习 → 答辩模拟一轮（含不看答案复述）→ 挑战页一个定位/改码任务</span></div>
          {!proj?.defense_date && (
            <div className="it"><span className="tag">提示</span><span>到总览页填答辩日期后，这里会给出倒计时与每日节奏。</span></div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="hd"><span className="file-no">RD-03</span><b>诚实边界</b></div>
        <div className="bd mut" style={{ fontSize: 11.5, lineHeight: 1.9 }}>
          六维能力（概念解释/代码定位/流程追踪/设计边界/修改验证/AI 协作）需要练习记录支撑；当前只展示有数据的三类：知识掌握分布、到期复习、最近发展区。不做没有证据的雷达图。
        </div>
      </div>
    </div>
  );
}

function Radar({ axes }: { axes: { label: string; ratio: number }[] }) {
  const n = Math.max(axes.length, 3);
  const cx = 150;
  const cy = 145;
  const R = 100;
  const pt = (i: number, r: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  };
  if (axes.length === 0) return null;
  const outer = axes.map((_, i) => pt(i, R).join(",")).join(" ");
  const inner = axes.map((a, i) => pt(i, R * Math.max(0.05, a.ratio)).join(",")).join(" ");
  const mid = axes.map((_, i) => pt(i, R * 0.66).join(",")).join(" ");
  return (
    <svg width="310" height="300" viewBox="0 0 310 300">
      <polygon points={outer} fill="none" stroke="#DCE4F0" />
      <polygon points={mid} fill="none" stroke="#DCE4F0" />
      <polygon points={inner} fill="rgba(27,42,74,.14)" stroke="#1B2A4A" strokeWidth="2" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <text key={a.label} x={x} y={y} fontSize="11" fill="#5B6B85" textAnchor="middle">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}
