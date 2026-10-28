import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { createRun, recoverStaleRuns } from "@/lib/tasks";

// tsx 是 devDependency，运行时只需要它的 CLI 文件路径。这里按路径拼接而不是 require.resolve：
// require.resolve 会让 webpack 顺着 tsx → esbuild 把 .d.ts 打进 server bundle，而 ESM 包又不允许
// 用 CJS 的 require.resolve 引用，两种做法都会让 next build 失败。
function resolveTsxCli(): string {
  const candidates = ["dist/cli.mjs", "dist/cli.cjs"].map((rel) =>
    path.join(process.cwd(), "node_modules", "tsx", rel)
  );
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("找不到 tsx CLI：请先 npm install（tsx 在 devDependencies 中）");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  // 启动恢复：把心跳超时的 running 任务重排（恢复计数>3 → failed）
  const recovered = recoverStaleRuns();
  void recovered;

  const body = (await req.json().catch(() => ({}))) as { idemKey?: string; kind?: string };
  // kind=map 走完整分析链；缺省仍是 scan
  const kind = body.kind === "map" ? "map" : "scan";

  // 幂等键：hash(项目路径 + kind + 文件数)——同项目同类型重跑复用进行中的 run
  const proj = db.prepare("SELECT root_path FROM projects WHERE id = ?").get(projectId) as { root_path: string };
  const fileCount = db.prepare("SELECT COUNT(*) as n FROM files WHERE project_id = ?").get(projectId) as { n: number };
  const idemKey = body.idemKey ?? crypto
    .createHash("sha256")
    .update(`${proj.root_path}|${kind}|${fileCount.n}`)
    .digest("hex");

  const runId = createRun(projectId, kind, idemKey);

  // 派生 worker 子进程（detached：浏览器关闭不影响任务）；直接 node + tsx/cli，绕过 npx
  const tsxCli = resolveTsxCli();
  const child = spawn(
    process.execPath,
    [tsxCli, "worker/worker.ts", "--run-id", String(runId)],
    { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true }
  );
  child.unref();

  return NextResponse.json({ ok: true, runId });
}