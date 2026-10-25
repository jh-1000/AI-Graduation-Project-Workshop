/**
 * 分析 worker 子进程。
 * 用法：npx tsx worker/worker.ts --run-id=<id>
 * - 状态机由自身推进 queued→running→completed；心跳写 analysis_runs
 * - 两条阶段链，由 analysis_runs.kind 决定：
 *   scan: scan（按文件批次 checkpoint，step=file:<n>/<total>）→ symbols → evidence
 *   map : evidence → flows → nodes → terms → practice
 * - 按 run.stage 决定起点；除 scan 外各阶段为一次性全量，重跑从阶段起点重做（幂等覆盖写）
 * - 启动即条件抢占：只有 queued/paused 的 run 能被接管，抢不到说明已有 worker 在跑，直接退出
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
const symbolsMod = require("../src/lib/symbols.ts") as typeof import("../src/lib/symbols");
const evidenceMod = require("../src/lib/evidence.ts") as typeof import("../src/lib/evidence");
const flowsMod = require("../src/lib/flows.ts") as typeof import("../src/lib/flows");
const analyzeMod = require("../src/lib/llm/analyze.ts") as typeof import("../src/lib/llm/analyze");
const { getDb } = dbMod;
const { heartbeat, setRunStatus } = tasksMod;
const { detectStack, isTextFile, extractFromFile } = scanMod;
const { extractSymbolsTs } = symbolsMod;
const { persistSymbols, persistEvidence } = evidenceMod;
const { detectFlows, persistFlows } = flowsMod;
const { analyzeNodes, analyzeTerms, analyzePractice } = analyzeMod;

const NOISE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "venv",
  "__pycache__", ".idea", ".vscode", "coverage", ".gradle", "target",
]);

const BATCH = Number(args.find((a) => a.startsWith("--batch="))?.split("=")[1]) || 50;
const BATCH_DELAY_MS = Number(args.find((a) => a.startsWith("--slow="))?.split("=")[1]) || 80;
// 单文件读取上限：超过则不读正文（不哈希、不抽证据），避免扫描期开销失控
const MAX_READ_BYTES = 10 * 1024 * 1024;
// 送 LLM 的文件数量上限：出站过滤器再按字符预算截断
const MAX_CONTEXT_FILES = 20;

type Stage =
  | "scan"
  | "symbols"
  | "evidence"
  | "flows"
  | "nodes"
  | "terms"
  | "practice";

const SCAN_STAGES: Stage[] = ["scan", "symbols", "evidence"];
const MAP_STAGES: Stage[] = ["symbols", "evidence", "flows", "nodes", "terms", "practice"];

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

async function runJob(): Promise<void> {
  const db = getDb();
  const run = db.prepare("SELECT * FROM analysis_runs WHERE id = ?").get(runId) as
    | {
        project_id: number;
        kind: string;
        status: string;
        stage: string | null;
        step: string | null;
        version: string;
      }
    | undefined;
  if (!run) throw new Error(`run 不存在：${runId}`);

  const stages = run.kind === "map" ? MAP_STAGES : SCAN_STAGES;

  // 条件抢占：仅 queued/paused 可被接管。running 说明另一个 worker 在跑（重复 spawn），终态说明无需再跑。
  const claimed = db
    .prepare(
      "UPDATE analysis_runs SET status = 'running', stage = COALESCE(stage, ?), heartbeat_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ? AND status IN ('queued','paused')"
    )
    .run(stages[0], runId);
  if (claimed.changes === 0) {
    console.log(`跳过：run ${runId} 当前状态 ${run.status}，已有 worker 接管或已终态`);
    process.exit(0);
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(run.project_id) as {
    id: number;
    root_path: string;
  };
  const root = project.root_path;
  const allFiles: string[] = [];
  walk(root, "", allFiles);

  const note = (stage: Stage, step: string, text: string): void => {
    db.prepare(
      "UPDATE analysis_runs SET stage = ?, step = ?, progress_note = ?, heartbeat_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(stage, step, text, runId);
  };

  // 起点：stage 命中当前链则从该阶段起，否则从头
  const startIndex = run.stage && stages.includes(run.stage as Stage) ? stages.indexOf(run.stage as Stage) : 0;
  const from = (s: Stage): boolean => stages.indexOf(s) >= startIndex;
  const summary: string[] = [];

  if (from("scan")) {
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
            if (st.size <= MAX_READ_BYTES) {
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
    summary.push(`files=${allFiles.length}`);
  }

  if (from("symbols")) {
    // symbols：按文件批次调 ts-morph，批间心跳，避免长阻塞被恢复流程判定为僵死
    const tsFiles = allFiles.filter((f) => /\.(ts|tsx)$/.test(f));
    const symbols: ReturnType<typeof extractSymbolsTs> = [];
    for (let i = 0; i < tsFiles.length; i += BATCH) {
      const slice = tsFiles.slice(i, i + BATCH);
      symbols.push(...extractSymbolsTs(root, slice));
      note("symbols", `symbols:${Math.min(i + slice.length, tsFiles.length)}/${tsFiles.length}`, `symbols=${symbols.length}`);
    }
    const r = persistSymbols(project.id, run.version, symbols);
    summary.push(`symbols=${r.inserted}`, `symbolsSkipped=${r.skipped}`);
    note("symbols", `symbols:${tsFiles.length}/${tsFiles.length}`, summary.join(" "));
  }

  // evidence 阶段：静态证据（端点/路由）一次性抽取后整体落库
  const endpoints: ReturnType<typeof extractFromFile>["endpoints"] = [];
  const routes: ReturnType<typeof extractFromFile>["routes"] = [];
  const contents = new Map<string, string>();
  if (from("evidence")) {
    const textFiles = allFiles.filter((f) => isTextFile(f));
    let skipped = 0;
    for (let i = 0; i < textFiles.length; i += BATCH) {
      const slice = textFiles.slice(i, i + BATCH);
      for (const rel of slice) {
        try {
          const abs = path.join(root, rel);
          if (fs.statSync(abs).size > MAX_READ_BYTES) {
            skipped++;
            continue;
          }
          const text = fs.readFileSync(abs, "utf8");
          contents.set(rel, text);
          const got = extractFromFile(rel, text);
          endpoints.push(...got.endpoints);
          routes.push(...got.routes);
        } catch {
          skipped++; // 读失败不写空证据行
        }
      }
      note("evidence", `evidence:${Math.min(i + slice.length, textFiles.length)}/${textFiles.length}`, `endpoints=${endpoints.length} routes=${routes.length}`);
    }
    const r = persistEvidence(project.id, run.version, endpoints, routes);
    summary.push(`evidence=${r.inserted}`, `evidenceSkipped=${r.skipped + skipped}`);
    note("evidence", `evidence:${textFiles.length}/${textFiles.length}`, summary.join(" "));
  }

  // 送 LLM 的上下文：按行数取最大的若干已解析文本文件，出站过滤器再按字符预算截断
  const contextParts = (): { path: string; content: string }[] => {
    if (contents.size === 0) return [];
    const rows = db
      .prepare(
        "SELECT path FROM files WHERE project_id = ? AND parse_mode = 'parsed' ORDER BY loc DESC LIMIT ?"
      )
      .all(project.id, MAX_CONTEXT_FILES) as { path: string }[];
    const parts: { path: string; content: string }[] = [];
    for (const row of rows) {
      const text = contents.get(row.path);
      if (text) parts.push({ path: row.path, content: text });
    }
    return parts;
  };

  if (from("flows")) {
    // 业务流程：确定性追踪（端点 → 调用点 → 服务端 → 数据表 → 响应），不依赖 LLM
    const drafts = detectFlows(endpoints, contents);
    const r = persistFlows(project.id, run.version, drafts);
    summary.push(`flows=${r.inserted}`, `flowsSkipped=${r.skipped}`);
    note("flows", `flows:${drafts.length}/${drafts.length}`, summary.join(" "));
  }

  if (from("nodes")) {
    const r = await analyzeNodes(project.id, run.version, contextParts());
    summary.push(`nodes=${r.inserted}`);
    note("nodes", "nodes:done", summary.join(" "));
  }

  if (from("terms")) {
    const r = await analyzeTerms(project.id, run.version, contextParts());
    summary.push(`terms=${r.inserted}`);
    note("terms", "terms:done", summary.join(" "));
  }

  if (from("practice")) {
    const r = await analyzePractice(project.id, run.version, contextParts());
    summary.push(`practice=${r.inserted}`);
    note("practice", "practice:done", summary.join(" "));
  }

  const stack = detectStack(root);
  db.prepare("UPDATE projects SET stack = ? WHERE id = ?").run(JSON.stringify(stack), project.id);
  setRunStatus(runId, "completed", { stage: "done", note: summary.join(" ") });
  process.exit(0);
}

const hb = setInterval(() => heartbeat(runId), 2000);
hb.unref?.();

runJob().catch((err: unknown) => {
  console.error("worker 失败：", err instanceof Error ? err.message : err);
  try {
    setRunStatus(runId, "failed", { note: err instanceof Error ? err.message : String(err) });
  } catch {
    /* 状态机不允许的转换则忽略 */
  }
  process.exit(1);
});