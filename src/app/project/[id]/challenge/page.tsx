"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Item = { id: number; kind: string; prompt: string; answer: string | null; hints: string | null; target_file: string | null; target_line: number | null };
type DiffFile = { path: string; patch: string; added: number; removed: number };
type VerifyRes = { exitCode: number; output: string; proofType: string; timedOut: boolean };

export default function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [pickFile, setPickFile] = useState("");
  const [pickLine, setPickLine] = useState("");
  const [result, setResult] = useState<"pass" | "fail" | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"locate" | "modify" | "mutation">("locate");

  // 改码状态
  const [runId, setRunId] = useState<number | null>(null);
  const [wsMode, setWsMode] = useState<string>("");
  const [wsPath, setWsPath] = useState<string>("");
  const [diff, setDiff] = useState<{ mode: string; files: DiffFile[]; modified: boolean } | null>(null);
  const [verifyCmd, setVerifyCmd] = useState("npm run typecheck");
  const [verifyRes, setVerifyRes] = useState<VerifyRes | null>(null);
  const [finalState, setFinalState] = useState<{ modified: boolean; verifyExecuted: boolean; verifyPassed: boolean; accepted: boolean } | null>(null);
  const [cErr, setCErr] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [authOn, setAuthOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollMsg, setRollMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, pre] = await Promise.all([
      fetch(`/api/projects/${id}/practice`).then((r) => r.json()),
      fetch(`/api/projects/${id}/preview`).then((r) => r.json()),
    ]);
    setItems(((p.items ?? []) as Item[]).filter((x) => x.kind === "locate"));
    setFiles(((pre.files ?? []) as { path: string }[]).map((f) => f.path));
    setLoading(false);
  }, [id]);

  const loadAuth = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      const data = await res.json();
      setAuthOn(Boolean(data.project.allow_modify));
    }
  }, [id]);

  useEffect(() => {
    void load();
    void loadAuth();
  }, [load, loadAuth]);

  const item = items[idx];

  function check() {
    if (!item) return;
    const lineOk = item.target_line === null || Math.abs(Number(pickLine) - item.target_line) <= 3;
    const fileOk = !item.target_file || pickFile === item.target_file;
    const ok = fileOk && lineOk;
    setResult(ok ? "pass" : "fail");
    void fetch(`/api/projects/${id}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, kind: "locate", correct: ok, independent: true, answerText: `${pickFile}:${pickLine}` }),
    });
  }

  async function authOn2() {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowModify: true }),
    });
    setAuthOn(true);
  }

  async function challengeAction(action: string, extra: Record<string, unknown> = {}) {
    setCErr(null);
    setBusy(true);
    const res = await fetch(`/api/projects/${id}/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, runId, ...extra }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      if (data.code === "AUTH_L5") setAuthNeeded(true);
      setCErr(data.error ?? "操作失败");
      return null;
    }
    return data;
  }

  async function startModify() {
    const r = await challengeAction("start");
    if (r) {
      setRunId(r.runId);
      setWsMode(r.mode);
      setWsPath(r.workspacePath);
      await refreshDiff(r.runId);
    }
  }

  async function refreshDiff(rid?: number) {
    const d = await challengeAction("state", rid ? { runId: rid } : {});
    if (d) setDiff({ mode: d.mode, files: d.files, modified: d.modified });
  }

  async function doVerify() {
    const r = await challengeAction("verify", { command: verifyCmd });
    if (r) setVerifyRes({ exitCode: r.exitCode, output: r.output, proofType: r.proofType, timedOut: r.timedOut });
  }

  async function doRollback() {
    const r = await challengeAction("rollback");
    if (r) {
      setRollMsg("已回滚：工作区恢复到基线状态");
      await refreshDiff();
    }
  }

  async function doComplete() {
    const r = await challengeAction("complete");
    if (r) setFinalState({ modified: r.modified, verifyExecuted: r.verifyExecuted, verifyPassed: r.verifyPassed, accepted: r.accepted });
  }

  if (loading) return <p className="sub">加载中…</p>;

  return (
    <div>
      <div className="toolrow">
        <div className="crumb" style={{ margin: 0 }}>CHALLENGE / 定位 · 改码 · 破坏实验 / Auth-L5+L2</div>
        <span className="badge b-src">隔离工作区 · 可回滚</span>
      </div>
      <h1 className="t">实战挑战</h1>
      <p className="sub">先定位、再动手、必须验证。三种结果分开展示——改了不等于验证了，验证了不等于验收了。</p>

      <div className="toolrow">
        <div className="depth">
          <button type="button" className={tab === "locate" ? "on" : ""} onClick={() => setTab("locate")}>定位题</button>
          <button type="button" className={tab === "modify" ? "on" : ""} onClick={() => setTab("modify")}>改码挑战</button>
          <button type="button" className={tab === "mutation" ? "on" : ""} onClick={() => setTab("mutation")}>破坏实验</button>
        </div>
      </div>

      {/* ── 定位题 ── */}
      {tab === "locate" && (
        <>
          <div className="card">
            <div className="hd">
              <span className="file-no">CH-01</span><b>定位题</b>
              <span className="right">{item ? <span className="badge b-infer">第 {idx + 1}/{items.length} 题</span> : <span className="badge b-none">题库为空</span>}</span>
            </div>
            <div className="bd" style={{ fontSize: 13, lineHeight: 1.9 }}>
              {item ? (
                <>
                  <div style={{ fontWeight: 600 }}>{item.prompt}</div>
                  <div className="toolrow">
                    <input
                      list="filelist"
                      value={pickFile}
                      onChange={(e) => { setPickFile(e.target.value); setResult(null); }}
                      placeholder="文件路径（可从列表选择）"
                      className="mono"
                      style={{ flex: 1, minWidth: 260, border: "1px solid var(--line)", borderRadius: 6, padding: "7px 10px", fontSize: 12.5 }}
                    />
                    <datalist id="filelist">
                      {files.map((f) => <option key={f} value={f} />)}
                    </datalist>
                    <input
                      value={pickLine}
                      onChange={(e) => { setPickLine(e.target.value); setResult(null); }}
                      placeholder="行号"
                      style={{ width: 90, border: "1px solid var(--line)", borderRadius: 6, padding: "7px 10px", fontSize: 12.5 }}
                    />
                    <button className="btn" type="button" onClick={check} disabled={!pickFile}>校验定位</button>
                  </div>
                  {result === "pass" && <div className="badge b-green" style={{ display: "inline-block", padding: "6px 12px", fontSize: 12 }}>✓ 定位命中（容差 ±3 行）</div>}
                  {result === "fail" && (
                    <div className="badge b-stale" style={{ display: "inline-block", padding: "6px 12px", fontSize: 12 }}>
                      ✗ 未命中 —— 正确答案在 {item.target_file}:{item.target_line ?? "?"}
                    </div>
                  )}
                  {result === "pass" && items.length > 1 && (
                    <div style={{ marginTop: 8 }}>
                      <button className="btn sm ghost" type="button" onClick={() => { setIdx((idx + 1) % items.length); setPickFile(""); setPickLine(""); setResult(null); }}>下一题 →</button>
                    </div>
                  )}
                </>
              ) : (
                <p className="mut">尚无定位题。运行「完整分析（map）」后由模型基于证据生成；未配 Key 时不会伪造题目。</p>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="hd"><span className="file-no">CH-02</span><b>验证闭环六查</b></div>
            <div className="bd" style={{ fontSize: 12.5, lineHeight: 2.1 }}>
              ✓ 定位正确（先定位后动手，+过程分）<br />
              ✓ 满足需求<br />
              ✓ 无副作用<br />
              ✓ 验证可跑则跑（不可跑显示"未验证"）<br />
              ✓ 能解释修改原因<br />
              ✓ 先定位再动手
            </div>
          </div>
        </>
      )}

      {/* ── 改码 / 破坏 共用基建 ── */}
      {(tab === "modify" || tab === "mutation") && (
        <>
          {authNeeded && (
            <div className="card" style={{ borderColor: "var(--mark-red)", marginBottom: 14 }}>
              <div className="bd" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
                <b style={{ color: "var(--mark-red)" }}>Auth-L5 未授权</b>：改码需要先打开本项目的「允许修改」开关。
                <button className="btn sm" type="button" style={{ marginLeft: 10 }} onClick={authOn2}>打开 Auth-L5（项目级）</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="hd">
              <span className="file-no">{tab === "modify" ? "CH-10" : "CH-11"}</span>
              <b>{tab === "modify" ? "改码挑战" : "破坏实验"}</b>
              <span className="right">
                {runId ? <span className="badge b-run">运行中 · run {runId} · {wsMode === "worktree" ? "git worktree" : "副本工作区"}</span> : <span className="badge b-none">未启动</span>}
              </span>
            </div>
            <div className="bd" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
              {tab === "modify" ? (
                <div>
                  目标：给「添加任务」加 loading 态防重复提交。<br />
                  验收条件：连点 3 次仅发 1 次请求；失败恢复；类型检查通过。<br />
                  禁止：改动 src/server 以下任何接口行为。
                </div>
              ) : (
                <div>
                  破坏任务：把 <code>setLoading(true)</code> 一行注释掉，然后连点按钮观察发生了什么。<br />
                  <span className="mut">用真实后果理解「为什么需要那两行状态代码」。实验后一键还原。</span>
                </div>
              )}
              <div className="toolrow">
                {!runId && (
                  <button className="btn" type="button" onClick={startModify} disabled={busy || authOn === false}>
                    启动隔离工作区
                  </button>
                )}
                {runId && (
                  <>
                    <button className="btn sm ghost" type="button" onClick={() => void refreshDiff()}>刷新 diff</button>
                    <button className="btn sm ghost" type="button" onClick={doRollback}>⟲ 一键回滚</button>
                    <button className="btn sm" type="button" onClick={doComplete}>终局判定</button>
                  </>
                )}
              </div>
              {wsPath && <div className="mut mono" style={{ fontSize: 11, marginTop: 6 }}>工作区：{wsPath}</div>}
              {cErr && <p style={{ color: "var(--mark-red)", fontSize: 12 }}>{cErr}</p>}
              {rollMsg && <p style={{ color: "var(--pass-green)", fontSize: 12 }}>{rollMsg}</p>}
            </div>
          </div>

          {runId && diff && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="hd"><span className="file-no">DIFF</span><b>变更 diff（{diff.files.length} 文件）</b>
                <span className="right">
                  <span className={`badge ${diff.modified ? "b-infer" : "b-none"}`}>{diff.modified ? "代码已修改" : "无修改"}</span>
                </span>
              </div>
              <div className="bd" style={{ maxHeight: 420, overflow: "auto" }}>
                {diff.files.length === 0 ? (
                  <p className="mut" style={{ fontSize: 12.5 }}>还没有修改。在工作区里编辑文件后点「刷新 diff」。</p>
                ) : (
                  diff.files.map((f) => (
                    <pre key={f.path} className="mono" style={{ background: "#0F1B33", color: "#D7E1F5", padding: 12, borderRadius: 8, fontSize: 11.5, overflow: "auto", whiteSpace: "pre-wrap" }}>
                      {f.patch}
                    </pre>
                  ))
                )}
              </div>
            </div>
          )}

          {runId && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="hd"><span className="file-no">VERIFY</span><b>验证命令（Auth-L2 · 单次授权）</b>
                <span className="right">
                  {verifyRes ? (
                    <span className={`badge ${verifyRes.exitCode === 0 ? "b-run" : "b-stale"}`}>
                      验证命令已执行 · {verifyRes.exitCode === 0 ? "通过" : "失败"} · {verifyRes.proofType}
                    </span>
                  ) : (
                    <span className="badge b-none">验证命令未执行</span>
                  )}
                </span>
              </div>
              <div className="bd">
                <div className="toolrow">
                  <input
                    className="mono"
                    value={verifyCmd}
                    onChange={(e) => setVerifyCmd(e.target.value)}
                    style={{ flex: 1, minWidth: 260, border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5 }}
                  />
                  <button className="btn sm" type="button" onClick={doVerify} disabled={busy}>运行验证</button>
                </div>
                <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>
                  副作用黑名单审查通过后才执行；cwd 锁定工作区；超时 120s；输出上限 100KB。
                </div>
                {verifyRes && (
                  <pre className="mono" style={{ background: "#0F1B33", color: "#D7E1F5", padding: 12, borderRadius: 8, fontSize: 11.5, overflow: "auto", maxHeight: 240, whiteSpace: "pre-wrap" }}>
                    {verifyRes.output || "（无输出）"}
                  </pre>
                )}
              </div>
            </div>
          )}

          {finalState && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="hd"><span className="file-no">FINAL</span><b>终局三态</b></div>
              <div className="bd state3" style={{ fontSize: 12.5 }}>
                <div className="st"><span>代码已修改</span><span className={`badge ${finalState.modified ? "b-run" : "b-none"}`}>{finalState.modified ? "是" : "否"}</span></div>
                <div className="st"><span>验证命令已执行</span><span className={`badge ${finalState.verifyExecuted ? "b-run" : "b-none"}`}>{finalState.verifyExecuted ? "是" : "否"}</span></div>
                <div className="st"><span>验收条件已满足</span><span className={`badge ${finalState.accepted ? "b-run" : "b-stale"}`}>{finalState.accepted ? "是" : "未满足"}</span></div>
                <div className="mut" style={{ marginTop: 6, fontSize: 11 }}>三者不等价——分别展示，绝不互相冒充。</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
