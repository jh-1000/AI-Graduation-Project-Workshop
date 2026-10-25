import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { getDb } from "@/lib/db";
import { createRun, recoverStaleRuns } from "@/lib/tasks";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projectId = Number(id);
  const db = getDb();
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  // 启动恢复：把心跳超时的 running 任务重排（恢复计数>3 → failed）
  const recovered = recoverStaleRuns();
  void recovered;

  const body = (await req.json().catch(() => ({}))) as { idemKey?: string };
  const runId = createRun(projectId, "scan", body.idemKey);

  // 派生 worker 子进程（detached：浏览器关闭不影响任务）；直接 node + tsx/cli，绕过 npx
  const tsxCli = require.resolve("tsx/cli");
  const child = spawn(
    process.execPath,
    [tsxCli, "worker/worker.ts", "--run-id", String(runId)],
    { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true }
  );
  child.unref();

  return NextResponse.json({ ok: true, runId });
}
