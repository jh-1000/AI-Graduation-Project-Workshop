"use client";
/** @aidd-ui 02-Design/modules/analysis/ui/p1-loop/UI.md */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Preview = {
  stack: { languages?: string[]; frameworks?: string[]; packageManagers?: string[] };
  stats: Record<string, number>;
  endpoints: { method: string; path: string; file: string; line: number }[];
  routes: { path: string; file: string; kind: string }[];
  files: { path: string; loc: number; parse_mode: string }[];
};

type Run = {
  id: number;
  version: string;
  kind: string;
  status: string;
  stage: string | null;
  step: string | null;
  progress_note: string | null;
  recovery_count: number;
  updated_at: string;
};

type EvidenceRow = {
  id: number;
  file_path: string;
  start_line: number | null;
  end_line: number | null;
  origin: string;
  processing: string;
  freshness: string;
  note: string | null;
};

type SymbolRow = {
  id: number;
  name: string;
  kind: string | null;
  line: number | null;
  precision: string;
  file_path: string;
};

type EvidenceResp = { analysisVersion: string | null; evidence: EvidenceRow[]; symbols: SymbolRow[] };

type FlowStep = {
  seq: number;
  title: string;
  file_path: string | null;
  start_line: number | null;
  note: string | null;
};

type Flow = {
  id: number;
  slug: string;
  title: string;
  trigger_desc: string | null;
  confidence: number | null;
  status: string;
  steps: FlowStep[];
};

type Node = {
  id: number;
  slug: string;
  title: string;
  kind: string;
  summary: string | null;
  sections: { heading: string; body: string }[];
  evidence_note: string | null;
  status: string;
};

type Term = {
  id: number;
  slug: string;
  title: string;
  plain_def: string | null;
  pro_def: string | null;
  example: string | null;
  pitfall: string | null;
  avoid_aliases: string[];
  status: string;
};

type PracticeItem = {
  id: number;
  kind: string;
  slug: string;
  prompt: string;
  answer: string | null;
  hints: string[];
  target_file: string | null;
  target_line: number | null;
  status: string;
};

function Badge({ children, tone }: { children: React.ReactNode; tone: "draft" | "pending" | "ok" }) {
  const cls =
    tone === "ok"
      ? "rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700"
      : tone === "pending"
        ? "rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700"
        : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600";
  return <span className={cls}>{children}</span>;
}

function statusTone(status: string): "draft" | "pending" | "ok" {
  if (status === "confirmed") return "ok";
  if (status === "pending_review") return "pending";
  return "draft";
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [evidence, setEvidence] = useState<EvidenceResp>({ analysisVersion: null, evidence: [], symbols: [] });
  const [flows, setFlows] = useState<Flow[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [practice, setPractice] = useState<PracticeItem[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [fatal, setFatal] = useState<string | null>(null);

  const load = useCallback(async () => {
    // 404/500 时接口返回 { error }，若照旧当数据用会让区块读到 undefined 而整页崩溃
    const pRes = await fetch(`/api/projects/${id}/preview`);
    if (!pRes.ok) {
      setFatal(pRes.status === 404 ? `项目 ${id} 不存在或已被删除` : `加载失败（HTTP ${pRes.status}）`);
      return;
    }
    setFatal(null);
    setPreview(await pRes.json());
    const dRes = await fetch(`/api/projects/${id}`);
    if (dRes.ok) setRuns((await dRes.json()).runs ?? []);
    const paths = ["evidence", "flows", "nodes", "terms", "practice"] as const;
    const [ev, fl, nd, tm, pr] = await Promise.all(
      paths.map(async (p) => {
        const r = await fetch(`/api/projects/${id}/${p}`);
        return r.ok ? await r.json() : {};
      })
    );
    setEvidence({ analysisVersion: ev.analysisVersion ?? null, evidence: ev.evidence ?? [], symbols: ev.symbols ?? [] });
    setFlows(fl.flows ?? []);
    setNodes(nd.nodes ?? []);
    setTerms(tm.terms ?? []);
    setPractice(pr.items ?? []);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeRun) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/runs/${activeRun}`).then((x) => x.json());
      if (r.run) {
        setRuns((prev) => [r.run, ...prev.filter((x) => x.id !== r.run.id)]);
        if (r.run.status === "completed" || r.run.status === "failed") {
          clearInterval(t);
          void load();
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [activeRun, load]);

  async function startAnalyze(kind: "scan" | "map") {
    setError(null);
    const res = await fetch(`/api/projects/${id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "启动失败");
    else setActiveRun(data.runId);
  }

  if (fatal) return <p className="text-sm text-red-600">{fatal}</p>;
  if (!preview) return <p className="text-sm text-slate-400">加载中…</p>;

  const quizzes = practice.filter((p) => p.kind === "quiz");
  const locates = practice.filter((p) => p.kind === "locate");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← 返回项目列表
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">项目分析</h1>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            初步清单 · 不代表完整分析
          </span>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">技术栈</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {[...(preview.stack.languages ?? []), ...(preview.stack.frameworks ?? [])].map((t) => (
              <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                {t}
              </span>
            ))}
            {(preview.stack.languages ?? []).length === 0 && (
              <span className="text-sm text-slate-400">未识别</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">文件解析情况</div>
          <div className="mt-2 space-y-1 text-sm">
            {Object.entries(preview.stats).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-600">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">后台分析任务</div>
          <button
            className="mt-2 w-full rounded bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => startAnalyze("scan")}
          >
            启动扫描任务（scan）
          </button>
          <button
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            onClick={() => startAnalyze("map")}
          >
            启动完整分析（map）
          </button>
          <p className="mt-2 text-xs text-slate-400">
            map 在 scan 产物之上追加业务流程、节点讲解、术语与练习；未配置模型密钥时讲解类产物为空。
          </p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </section>

      {runs.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
            任务（断点续跑演示：重启应用或等待超时后任务会自动重排）
          </h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2">版本</th>
                <th className="px-5 py-2">类型</th>
                <th className="px-5 py-2">状态</th>
                <th className="px-5 py-2">阶段/步骤</th>
                <th className="px-5 py-2">恢复次数</th>
                <th className="px-5 py-2">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-5 py-2 font-mono text-xs">{r.version}</td>
                  <td className="px-5 py-2 text-xs text-slate-600">{r.kind}</td>
                  <td className="px-5 py-2">
                    <span
                      className={
                        r.status === "completed"
                          ? "rounded bg-green-100 px-2 py-0.5 text-xs text-green-700"
                          : r.status === "running"
                            ? "rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700"
                            : "rounded bg-slate-100 px-2 py-0.5 text-xs"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-2 font-mono text-xs">
                    {r.stage} {r.step ?? ""}
                  </td>
                  <td className="px-5 py-2">{r.recovery_count}</td>
                  <td className="px-5 py-2 text-xs text-slate-500">{r.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm font-medium">
          证据卡
          <span className="text-xs font-normal text-slate-400">
            {evidence.analysisVersion
              ? `版本 ${evidence.analysisVersion} · 证据 ${evidence.evidence.length} 条 · 符号 ${evidence.symbols.length} 个`
              : "尚无证据：先启动一次扫描任务"}
          </span>
        </h2>
        {evidence.evidence.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {evidence.evidence.slice(0, 20).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 px-5 py-2">
                <span className="font-mono text-xs text-slate-700">
                  {e.file_path}
                  {e.start_line ? `:${e.start_line}` : ""}
                </span>
                <span className="text-xs text-slate-600">{e.note}</span>
                <span className="ml-auto flex gap-1">
                  <Badge tone="draft">{e.origin}</Badge>
                  <Badge tone="draft">{e.processing}</Badge>
                  <Badge tone={e.freshness === "current" ? "ok" : "pending"}>{e.freshness}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        {evidence.symbols.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-slate-100 px-5 py-3">
            {evidence.symbols.slice(0, 40).map((s) => (
              <span key={s.id} className="rounded bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600">
                {s.name}
                <span className="text-slate-400">
                  {" "}
                  {s.file_path}
                  {s.line ? `:${s.line}` : ""}
                </span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
          业务流程（{flows.length}）
        </h2>
        {flows.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400">
            尚无业务流程：启动一次「完整分析（map）」后生成（确定性追踪，不需要模型密钥）。
          </p>
        )}
        <div className="divide-y divide-slate-100">
          {flows.map((f) => (
            <div key={f.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{f.title}</span>
                <Badge tone={statusTone(f.status)}>{f.status}</Badge>
                {f.trigger_desc && <span className="text-xs text-slate-400">触发：{f.trigger_desc}</span>}
              </div>
              <ol className="mt-3 space-y-2">
                {f.steps.map((s) => (
                  <li key={s.seq} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                      {s.seq}
                    </span>
                    <span className="flex-1">{s.title}</span>
                    <span className="font-mono text-xs text-slate-400">
                      {s.file_path ?? "?"}
                      {s.start_line ? `:${s.start_line}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
          知识节点（{nodes.length}）
        </h2>
        {nodes.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400">
            尚无节点讲解：该部分由模型生成，需先在设置页填写 API Key 后重跑完整分析。
          </p>
        )}
        <div className="divide-y divide-slate-100">
          {nodes.map((n) => (
            <div key={n.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{n.title}</span>
                <Badge tone="draft">{n.kind}</Badge>
                <Badge tone={statusTone(n.status)}>{n.status}</Badge>
              </div>
              {n.summary && <p className="mt-2 text-sm text-slate-600">{n.summary}</p>}
              {n.sections.map((s, i) => (
                <div key={i} className="mt-3">
                  <div className="text-xs font-medium text-slate-500">{s.heading}</div>
                  <p className="mt-1 text-sm text-slate-700">{s.body}</p>
                </div>
              ))}
              {n.evidence_note && (
                <p className="mt-2 font-mono text-xs text-slate-400">依据：{n.evidence_note}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
          术语卡片（{terms.length}）
        </h2>
        {terms.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400">尚无术语：需模型生成，配置密钥后重跑完整分析。</p>
        )}
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {terms.map((t) => (
            <details key={t.id} className="rounded border border-slate-200 px-3 py-2">
              <summary className="cursor-pointer text-sm">
                {t.title}
                {t.status === "draft" && <span className="ml-1 text-xs text-amber-600">待复核</span>}
              </summary>
              <div className="mt-2 max-w-md space-y-1 text-xs text-slate-600">
                {t.plain_def && <p>通俗：{t.plain_def}</p>}
                {t.pro_def && <p>专业：{t.pro_def}</p>}
                {t.example && <p className="font-mono">示例：{t.example}</p>}
                {t.pitfall && <p className="text-amber-700">误区：{t.pitfall}</p>}
                {t.avoid_aliases.length > 0 && (
                  <p className="text-slate-400">别名：{t.avoid_aliases.join("、")}</p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">自测题（{quizzes.length}）</h2>
          {quizzes.length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">尚无自测题：需模型生成。</p>
          )}
          <ul className="divide-y divide-slate-100">
            {quizzes.map((q) => (
              <li key={q.id} className="px-5 py-3">
                <p className="text-sm">{q.prompt}</p>
                {q.hints.length > 0 && (
                  <p className="mt-1 text-xs text-slate-400">提示：{q.hints.join(" / ")}</p>
                )}
                <button
                  className="mt-2 text-xs text-blue-700 hover:underline"
                  onClick={() => setRevealed((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                >
                  {revealed[q.id] ? "收起答案" : "查看答案"}
                </button>
                {revealed[q.id] && <p className="mt-1 text-sm text-slate-700">{q.answer}</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
            定位挑战（{locates.length}）
          </h2>
          {locates.length === 0 && (
            <p className="px-5 py-6 text-sm text-slate-400">尚无定位挑战：需模型生成。</p>
          )}
          <ul className="divide-y divide-slate-100">
            {locates.map((q) => (
              <li key={q.id} className="px-5 py-3">
                <p className="text-sm">{q.prompt}</p>
                <button
                  className="mt-2 text-xs text-blue-700 hover:underline"
                  onClick={() => setRevealed((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                >
                  {revealed[q.id] ? "收起位置" : "揭示位置"}
                </button>
                {revealed[q.id] && (
                  <p className="mt-1 font-mono text-xs text-slate-700">
                    {q.target_file ?? "?"}
                    {q.target_line ? `:${q.target_line}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
            API 端点（{preview.endpoints.length}）
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {preview.endpoints.slice(0, 30).map((e, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2">
                <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs text-white">
                  {e.method}
                </span>
                <span className="font-mono">{e.path}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {e.file}:{e.line}
                </span>
              </li>
            ))}
            {preview.endpoints.length === 0 && (
              <li className="px-5 py-8 text-center text-slate-400">未抽取到端点</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
            前端路由（{preview.routes.length}）
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {preview.routes.slice(0, 30).map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2">
                <span className="font-mono">{r.path}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {r.kind} · {r.file}
                </span>
              </li>
            ))}
            {preview.routes.length === 0 && (
              <li className="px-5 py-8 text-center text-slate-400">未抽取到路由</li>
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-medium">
          文件（前 {Math.min(preview.files.length, 100)} / 共 {preview.files.length}）
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {preview.files.slice(0, 100).map((f) => (
              <tr key={f.path} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-1.5 font-mono text-xs">{f.path}</td>
                <td className="px-5 py-1.5 text-right text-xs text-slate-500">{f.loc} 行</td>
                <td className="px-5 py-1.5 text-right">
                  <span
                    className={
                      f.parse_mode === "parsed"
                        ? "rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
                        : "rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500"
                    }
                  >
                    {f.parse_mode}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
