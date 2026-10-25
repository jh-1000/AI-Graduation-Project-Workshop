import { spawn } from "node:child_process";
import { getDb } from "../../src/lib/db";
import { createRun, getRun } from "../../src/lib/tasks";
const db = getDb();
const p = db.prepare("SELECT id FROM projects WHERE slug = ?").get("c-loop-fixture1") as { id: number };
const runId = createRun(p.id, "scan", `timing-${Date.now()}`);
const t0 = Date.now();
const tsxCli = require.resolve("tsx/cli");
const child = spawn(process.execPath, [tsxCli, "worker/worker.ts", "--run-id", String(runId), "--batch=2", "--slow=600"], { cwd: process.cwd(), stdio: "ignore", windowsHide: true });
child.on("exit", (c) => {
  const r = getRun(runId) as { status: string; step: string | null };
  console.log(`exit=${c} 耗时=${Date.now() - t0}ms status=${r.status} step=${r.step}`);
  process.exit(0);
});
