"use client";

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
  status: string;
  stage: string | null;
  step: string | null;
  progress_note: string | null;
  recovery_count: number;
  updated_at: string;
};

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = await fetch(`/api/projects/${id}/preview`).then((r) => r.json());
    setPreview(p);
    const d = await fetch(`/api/projects/${id}`).then((r) => r.json());
    setRuns(d.runs ?? []);
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

  async function startAnalyze() {
    setError(null);
    const res = await fetch(`/api/projects/${id}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "启动失败");
    else setActiveRun(data.runId);
  }

  if (!preview) return <p className="text-sm text-slate-400">加载中…</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← 返回项目列表
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Scan 预览</h1>
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
            onClick={startAnalyze}
          >
            启动扫描任务（worker）
          </button>
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
