"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import FolderBrowser from "./FolderBrowser";

type Project = {
  id: number;
  slug: string;
  name: string;
  source_type: string;
  file_count: number;
  created_at: string;
};

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [mode, setMode] = useState<"path" | "zip">("path");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [defenseDate, setDefenseDate] = useState("");
  const [judgeAsk, setJudgeAsk] = useState("");
  const [afraid, setAfraid] = useState("");

  async function load() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.projects ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mode,
          path,
          defenseDate,
          mission: [judgeAsk, afraid].filter(Boolean).join(" || ") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");
      router.push(`/project/${data.projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="项目分析学习系统"
      subtitle="便携模式 · 数据仅在 data/"
      items={[
        { no: "00", label: "从这里开始", href: "/" },
        { no: "01", label: "设置与授权", href: "/settings" },
      ]}
      foot={
        <>
          证据优先 · AI 不产生事实
          <br />
          随目录拷贝即可迁移
        </>
      }
    >
    <div>
      <div className="crumb">HOME / 项目档案</div>
      <h1 className="t">你最想弄明白什么？</h1>
      <p className="sub">
        导入一个项目，系统会把它拆成可回溯到源码的证据卡、业务流程线和练习题。
        全部数据只存在本机 <code>data/</code> 目录——随目录拷贝即可迁移。
      </p>

      {/* 导入卡 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="hd">
          <span className="file-no">IM-01</span>
          <b>新建分析</b>
          <span className="right">
            <span className="badge b-src">只读导入</span>
            <span className="badge b-none">不执行项目脚本</span>
          </span>
        </div>
        <div className="bd">
          <div className="row2">
            <div className="field" style={{ margin: 0 }}>
              <label>项目名称</label>
              <input
                type="text"
                placeholder="如：物流管理系统"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>来源方式</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "path" | "zip")}
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 6, padding: "9px 12px", fontSize: 13, background: "#fff", color: "var(--ink)" }}
              >
                <option value="path">本地路径</option>
                <option value="zip">zip 包</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>{mode === "path" ? "本地绝对路径" : "zip 文件绝对路径"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder={mode === "path" ? "E:\\projects\\my-app" : "E:\\downloads\\project.zip"}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setBrowseOpen(true)}
                style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: 12.5 }}
              >
                📁 浏览
              </button>
            </div>
          </div>
          <div className="mission" style={{ marginTop: 12 }}>
            <div className="mut" style={{ fontSize: 11.5, marginBottom: 6 }}>
              答辩任务书（可选，但强烈建议——讲解、出题、冲刺计划都以它为锚）
            </div>
            <div className="row2" style={{ marginBottom: 8 }}>
              <input className="mono" placeholder="答辩日期，如 2026-11-08" value={defenseDate} onChange={(e) => setDefenseDate(e.target.value)}
                style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5 }} />
              <input placeholder="评委最可能追问什么？" value={judgeAsk} onChange={(e) => setJudgeAsk(e.target.value)}
                style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5 }} />
            </div>
            <input placeholder="你最怕被问到什么？" value={afraid} onChange={(e) => setAfraid(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5 }} />
          </div>
          {error && <div className="not-proved" style={{ marginTop: 8 }}>{error}</div>}
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="btn"
              disabled={busy || !name || !path}
              onClick={submit}
            >
              {busy ? "导入中…" : "导入并扫描"}
            </button>
            <span className="mut" style={{ fontSize: 11.5 }}>
              node_modules / .git / dist 自动跳过 · GBK 文件名已处理
            </span>
          </div>
        </div>
      </div>

      {/* 五站导览 */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="hd">
          <span className="file-no">GUIDE</span>
          <b>五站导览</b>
          <span className="right"><span className="mut" style={{ fontSize: 11 }}>从认识项目到独立修改</span></span>
        </div>
        <div className="bd">
          <div className="metro">
            <div className="track"><div className="done" style={{ width: "0%" }} /></div>
            {[
              { n: 1, t: "认识项目", d: "看技术栈、文件清单、端点" },
              { n: 2, t: "走通功能", d: "业务流程线：添加任务发生了什么" },
              { n: 3, t: "关键机制", d: "知识节点：架构与模块深挖" },
              { n: 4, t: "答辩拷问", d: "自测题 + 定位挑战" },
              { n: 5, t: "独立修改", d: "挑战隔离区（P4）" },
            ].map((s) => (
              <div key={s.n} className="station" style={{ cursor: "default" }}>
                <div className="dot">{s.n}</div>
                <div className="lbl">{s.t}<br /><span style={{ fontSize: 11, color: "var(--muted)" }}>{s.d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 我的项目 */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="hd">
          <span className="file-no">LIB-00</span>
          <b>我的项目</b>
          <span className="right">
            <span className="mut" style={{ fontSize: 11 }}>{projects.length} 个已导入</span>
          </span>
        </div>
        <div className="bd">
          {projects.length === 0 ? (
            <div className="empty">
              还没有项目。导入第一个项目，从看见它的文件清单和端点开始。
            </div>
          ) : (
            <table className="ptable">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>来源</th>
                  <th>文件数</th>
                  <th>导入时间</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/project/${p.id}`} style={{ fontWeight: 600 }}>
                        {p.name}
                      </Link>
                      <div className="mut mono" style={{ fontSize: 11, marginTop: 2 }}>{p.slug}</div>
                    </td>
                    <td>{p.source_type === "zip" ? "zip 包" : "本地路径"}</td>
                    <td>{p.file_count}</td>
                    <td className="mut" style={{ fontSize: 12 }}>{p.created_at}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/project/${p.id}`} className="btn sm ghost">进入 →</Link>
                      <button
                        className="btn sm ghost"
                        style={{ marginLeft: 6, color: "var(--mark-red)", borderColor: "var(--mark-red)" }}
                        onClick={async () => {
                          if (!confirm(`确定删除「${p.name}」？所有分析数据将不可恢复。`)) return;
                          await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
                          void load();
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    <FolderBrowser open={browseOpen} mode={mode} onClose={() => setBrowseOpen(false)} onPick={(p) => { setPath(p); }} />
    </AppShell>
  );
}
