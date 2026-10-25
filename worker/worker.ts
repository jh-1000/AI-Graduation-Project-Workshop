/**
 * 分析 worker 子进程。
 * 用法：npx tsx worker/worker.ts --run-id=<id>
 * - 状态机由自身推进 queued→running→completed；心跳写 analysis_runs
 * - scan 任务按文件批次 checkpoint（step=batch:<i>），被杀后可从恢复位置继续
 * - 被强杀时不做任何清理：status 保持 running，由启动恢复流程重排（恢复计数>3 → failed）
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
// 兼容 "--run-id=X" 与 "--run-id X" 两种形式
function argValue(name: string): string | undefined {
  const joined = args.find((a) => a.startsWith(`--${name}=`));
  if (joined) return joined.split("=").slice(1).join("=");
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return undefined;
}
const runIdStr = argValue("run-id");
if (!runIdStr) {
  console.error("缺少 --run-id");
  process.exit(1);
}
const runId = Number(runIdStr);

// 相对导入，避免 tsx 下 path alias 不生效
const dbMod = require("../src/lib/db/index.ts") as typeof import("../src/lib/db/index");
const tasksMod = require("../src/lib/tasks.ts") as typeof import("../src/lib/tasks");
const scanMod = require("../src/lib/scan.ts") as typeof import("../src/lib/scan");
const { getDb } = dbMod;
const { heartbeat, setRunStatus } = tasksMod;
const { detectStack, isTextFile } = scanMod;

const NOISE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "venv",
  "__pycache__", ".idea", ".vscode", "coverage", ".gradle", "target",
]);

const BATCH = Number(args.find((a) => a.startsWith("--batch="))?.split("=")[1]) || 50;
const BATCH_DELAY_MS = Number(args.find((a) => a.startsWith("--slow="))?.split("=")[1]) || 80;

function walk(root: string, relBase: string, out: string[]): void {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (NOISE_DIRS.has(entry.name)) continue;
      walk(path.join(root, entry.name), path.join(relBase, entry.name), out);
    } else if (entry.isFile()) {
      out.push(path.join(relBase, entry.name).replace(/\\/g, "/"));
    }
  }
}

async function runScanJob(): Promise<void> {
  const db = getDb();
  const run = db.prepare("SELECT * FROM analysis_runs WHERE id = ?").get(runId) as
    | { project_id: number; status: string; step: string | null }
    | undefined;
  if (!run) throw new Error(`run 不存在：${runId}`);
  setRunStatus(runId, "running", { stage: "scan", step: run.step ?? "file:0" });

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(run.project_id) as {
    id: number;
    root_path: string;
  };
  const root = project.root_path;
  const allFiles: string[] = [];
  walk(root, "", allFiles);

  const updFile = db.prepare(
    "UPDATE files SET loc = ?, content_hash = ?, parse_mode = ? WHERE project_id = ? AND path = ?"
  );
  const insRunFile = db.prepare(
    "INSERT OR REPLACE INTO run_files (run_id, project_id, path, size, mtime, sha256) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const crypto = await import("node:crypto");

  // 断点续跑：检查点 = 已完成文件数（file:<n>/<total>），与批次大小解耦
  const startFile = Number((run.step ?? "file:0").replace("file:", "").split("/")[0]) || 0;
  for (let i = startFile; i < allFiles.length; i += BATCH) {
    const slice = allFiles.slice(i, i + BATCH);
    const tx = db.transaction(() => {
      for (const rel of slice) {
        const abs = path.join(root, rel);
        let size = 0;
        let mtime = "";
        let hash = "";
        let loc = 0;
        try {
          const st = fs.statSync(abs);
          size = st.size;
          mtime = st.mtime.toISOString();
          if (st.size <= 10 * 1024 * 1024) {
            const buf = fs.readFileSync(abs);
            hash = crypto.createHash("sha256").update(buf).digest("hex");
            loc = isTextFile(rel) ? buf.toString("utf8").split("\n").length : 0;
          }
        } catch {
          /* 读失败跳过，保持快照空哈希 */
        }
        updFile.run(loc, hash, isTextFile(rel) ? "parsed" : "text_only", project.id, rel);
        insRunFile.run(runId, project.id, rel, size, mtime, hash);
      }
    });
    tx();
    heartbeat(runId, "scan", `file:${i + slice.length}/${allFiles.length}`);
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS)); // 模拟真实开销，便于断点演示
  }
  const stack = detectStack(root);
  db.prepare("UPDATE projects SET stack = ? WHERE id = ?").run(JSON.stringify(stack), project.id);
  setRunStatus(runId, "completed", { stage: "done", note: `files=${allFiles.length}` });
  process.exit(0);
}

const hb = setInterval(() => heartbeat(runId), 2000);
hb.unref?.();

runScanJob().catch((err: unknown) => {
  console.error("worker 失败：", err instanceof Error ? err.message : err);
  try {
    setRunStatus(runId, "failed", { note: err instanceof Error ? err.message : String(err) });
  } catch {
    /* 状态机不允许的转换则忽略 */
  }
  process.exit(1);
});
