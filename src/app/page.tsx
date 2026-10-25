"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
        body: JSON.stringify({ name, mode, path }),
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
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">项目</h1>
        <p className="mt-1 text-sm text-slate-500">
          导入你要吃透的项目。全部数据只存在本机 data/ 目录（便携模式：随目录拷贝即可迁移）。
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-medium">新建分析</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="项目名称，如：物流管理系统"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm font-mono"
            placeholder={mode === "path" ? "本地绝对路径，如 E:\\projects\\my-app" : "zip 文件绝对路径"}
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <select
              className="rounded border border-slate-300 px-2 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as "path" | "zip")}
            >
              <option value="path">本地路径</option>
              <option value="zip">zip 包</option>
            </select>
            <button
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={busy || !name || !path}
              onClick={submit}
            >
              {busy ? "导入中…" : "导入并扫描"}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3">名称</th>
              <th className="px-5 py-3">slug</th>
              <th className="px-5 py-3">来源</th>
              <th className="px-5 py-3">文件数</th>
              <th className="px-5 py-3">导入时间</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3">
                  <Link href={`/project/${p.id}`} className="text-blue-700 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-5 py-3 font-mono text-xs">{p.slug}</td>
                <td className="px-5 py-3">{p.source_type === "zip" ? "zip 包" : "本地路径"}</td>
                <td className="px-5 py-3">{p.file_count}</td>
                <td className="px-5 py-3 text-slate-500">{p.created_at}</td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                  还没有项目。导入第一个项目，从看见它的文件清单开始。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
