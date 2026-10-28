/**
 * 分析 worker 子进程。
 * 用法：npx tsx worker/worker.ts --run-id=<id>
 * - 状态机由自身推进 queued→running→completed；心跳写 analysis_runs
 * - 两条阶段链，由 analysis_runs.kind 决定：
 *   scan: scan（按文件批次 checkpoint，step=file:<n>/<total>）→ symbols → evidence → claims
 *   map : scan → lockfile → symbols → evidence → flows → claims → nodes → terms → practice
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
const claimsMod = require("../src/lib/claims.ts") as typeof import("../src/lib/claims");
const analyzeMod = require("../src/lib/llm/analyze.ts") as typeof import("../src/lib/llm/analyze");
const repomapMod = require("../src/lib/repomap.ts") as typeof import("../src/lib/repomap");
const auditMod = require("../src/lib/audit.ts") as typeof import("../src/lib/audit");
const edgesMod = require("../src/lib/edges.ts") as typeof import("../src/lib/edges");
const gitlogMod = require("../src/lib/gitlog.ts") as typeof import("../src/lib/gitlog");
const dualcheckMod = require("../src/lib/dualcheck.ts") as typeof import("../src/lib/dualcheck");
const coverageMod = require("../src/lib/coverage.ts") as typeof import("../src/lib/coverage");
const multiMod = require("../src/lib/symbols-multi.ts") as typeof import("../src/lib/symbols-multi");
const { getDb } = dbMod;
const { heartbeat, setRunStatus } = tasksMod;
const { detectStack, isTextFile, extractFromFile, extractNextApiEndpoints, extractNextPagesApiEndpoints } = scanMod;
const { extractSymbolsTs } = symbolsMod;
const { persistSymbols, persistEvidence } = evidenceMod;
const { detectFlows, persistFlows } = flowsMod;
const { persistClaims } = claimsMod;
const { analyzeNodes, analyzeTerms, analyzePractice, analyzeArchitecture, analyzeModuleDeep, analyzeConfusions, analyzeTechPath, recordOpenQuestion } = analyzeMod;
const { selectContextFiles } = repomapMod;
const { runAudit } = auditMod;
const { buildEdges } = edgesMod;
const { runGitArchaeology } = gitlogMod;
const { runDualCheck } = dualcheckMod;
const { runCoverage } = coverageMod;
const lockfileMod = require("../src/lib/lockfile.ts") as typeof import("../src/lib/lockfile");
const { runLockfileScan } = lockfileMod;
const { extractSymbolsMulti } = multiMod;

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
  | "lockfile"
  | "symbols"
  | "evidence"
  | "flows"
  | "claims"
  | "audit"
  | "edges"
  | "gitlog"
  | "architecture"
  | "nodes"
  | "terms"
  | "confusions"
  | "techpath"
  | "module"
  | "practice"
  | "dualcheck"
  | "coverage";

// claims 排在确定性阶段末尾：它只依赖 evidence + flows，不需要模型密钥
const SCAN_STAGES: Stage[] = ["scan", "lockfile", "symbols", "evidence", "claims"];
const MAP_STAGES: Stage[] = [
  "scan", "lockfile", "symbols", "evidence", "flows", "claims",
  "audit", "edges", "gitlog",
  "architecture", "nodes", "terms", "module", "practice",
  "dualcheck", "coverage",
];

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

  // P2 预算：token 上限来自设置；0 = 不限。超限后 LLM 阶段降级为开放问题，不整单失败。
  const budgetRow = db.prepare("SELECT value FROM settings WHERE key = 'llm_budget_tokens'").get() as
    | { value: string }
    | undefined;
  process.env.PAL_BUDGET_TOKENS = budgetRow?.value ?? "0";

  /** LLM 阶段安全包装：预算超限/调用失败 → 记开放问题并继续，不让整条流水线失败 */
  const llmStage = async (stage: string, fn: () => Promise<string>): Promise<void> => {
    try {
      const text = await fn();
      summary.push(text);
      note(stage as Stage, `${stage}:done`, summary.join(" "));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isBudget = (err as { name?: string })?.name === "BudgetExceededError";
      recordOpenQuestion(
        project.id,
        run.version,
        isBudget ? `预算耗尽：${stage} 阶段未完成` : `LLM 阶段失败：${stage}`,
        msg,
        isBudget ? "调高设置页的 token 预算，或缩小分析深度后重跑 map" : "检查模型配置与连通性后重跑"
      );
      summary.push(`${stage}=skipped`);
      note(stage as Stage, `${stage}:skipped`, summary.join(" "));
    }
  };

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

  if (from("lockfile")) {
    const r = runLockfileScan(project.id, run.version, root);
    summary.push(`lockfileDeps=${r.deps}`);
    note("lockfile", "lockfile:done", summary.join(" "));
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
    // P5.4 多语言：py/go/java/rust/c/cpp 走 tree-sitter
    const multi = await extractSymbolsMulti(
      root,
      allFiles.map((f) => ({ path: f, ext: path.extname(f) }))
    );
    const insMulti = db.prepare(
      "INSERT INTO symbols (project_id, analysis_version, file_id, name, kind, line, identify_by, precision) VALUES (?, ?, ?, ?, ?, ?, 'tree-sitter', 'exact')"
    );
    const fileIdByPath = new Map(
      (db.prepare("SELECT id, path FROM files WHERE project_id = ?").all(project.id) as { id: number; path: string }[]).map((f) => [f.path, f.id])
    );
    let multiCount = 0;
    const txMulti = db.transaction(() => {
      for (const m of multi) {
        const fid = fileIdByPath.get(m.file);
        if (!fid) continue;
        insMulti.run(project.id, run.version, fid, m.name, m.kind, m.line);
        multiCount += 1;
      }
    });
    txMulti();
    const r2 = persistSymbols(project.id, run.version, symbols);
    void r2;
    summary.push(`symbols=${symbols.length + multiCount}`, `multi=${multiCount}`);
    note("symbols", `symbols:${tsFiles.length}/${tsFiles.length}`, summary.join(" "));
  }

  // evidence 阶段：静态证据（端点/路由）一次性抽取后整体落库
  const endpoints: ReturnType<typeof extractFromFile>["endpoints"] = [];
  const routes: ReturnType<typeof extractFromFile>["routes"] = [];
  const contents = new Map<string, string>();
  if (from("evidence")) {
    // 快照核对（计划 §4）：每阶段开始前对本阶段将读取的文件重算哈希与 run_files 快照对比。
    // 不匹配 → 该文件跳过证据抽取并记 open_question；不匹配比例 >5% → 标 stale。
    const textFiles = allFiles.filter((f) => isTextFile(f));
    const snapshot = new Map<string, string>();
    db.prepare("SELECT path, sha256 FROM run_files WHERE run_id = ?").all(runId)
      .forEach((r: unknown) => {
        const row = r as { path: string; sha256: string };
        snapshot.set(row.path, row.sha256);
      });
    let skipped = 0;
    let staleFiles = 0;
    const crypto = await import("node:crypto");
    for (let i = 0; i < textFiles.length; i += BATCH) {
      const slice = textFiles.slice(i, i + BATCH);
      for (const rel of slice) {
        try {
          const abs = path.join(root, rel);
          if (fs.statSync(abs).size > MAX_READ_BYTES) {
            skipped++;
            continue;
          }
          const buf = fs.readFileSync(abs);
          const text = buf.toString("utf8");
          const nowHash = crypto.createHash("sha256").update(buf).digest("hex");
          contents.set(rel, text);

          const snapHash = snapshot.get(rel);
          if (snapHash && snapHash !== nowHash) {
            // 文件在 scan 后被修改——证据位置可能漂移，跳过证据抽取
            staleFiles++;
            db.prepare(
              "INSERT INTO open_questions (project_id, analysis_version, question, why, next_check) VALUES (?, ?, ?, ?, ?)"
            ).run(
              project.id, run.version,
              `分析期间文件变化：${rel}`,
              "该文件在 scan 快照后被修改，证据行号可能漂移",
              "重跑 map 任务以刷新快照"
            );
            continue;
          }
          const got = extractFromFile(rel, text);
          endpoints.push(...got.endpoints);
          endpoints.push(...extractNextApiEndpoints(rel, text));
          const pagesEp = extractNextPagesApiEndpoints(rel);
          if (pagesEp) endpoints.push(pagesEp);
          routes.push(...got.routes);
        } catch {
          skipped++; // 读失败不写空证据行
        }
      }
      note("evidence", `evidence:${Math.min(i + slice.length, textFiles.length)}/${textFiles.length}`, `endpoints=${endpoints.length} routes=${routes.length} stale=${staleFiles}`);
    }
    const r = persistEvidence(project.id, run.version, endpoints, routes);
    summary.push(`evidence=${r.inserted}`, `evidenceSkipped=${r.skipped + skipped}`);
    if (snapshot.size > 0 && staleFiles / snapshot.size > 0.05) {
      summary.push(`STALE=${Math.round((staleFiles / snapshot.size) * 100)}%文件已变化`);
    }
    note("evidence", `evidence:${textFiles.length}/${textFiles.length}`, summary.join(" "));
  }

  // 送 LLM 的上下文：用 PageRank 选料（替代旧的"按 loc DESC 取前 20"占位）。
  // 旧策略：文件越长越被选，小工具文件永远进不了上下文。
  // 新策略：ts-morph 抽全库 import 关系建引用图，PageRank 选被引用多的核心文件，
  //         再按字符预算贪心截断。选料只影响 LLM 上下文，不影响覆盖统计口径。
  const contextParts = (): { path: string; content: string }[] => {
    if (contents.size === 0) return [];
    const weights = [...contents.entries()].map(([p, text]) => ({ path: p, chars: text.length }));
    const { selected } = selectContextFiles(root, weights, 60_000, MAX_CONTEXT_FILES);
    return selected.map((p) => ({ path: p, content: contents.get(p) ?? "" }));
  };

  if (from("flows")) {
    // 业务流程：确定性追踪（端点 → 调用点 → 服务端 → 数据表 → 响应），不依赖 LLM
    const drafts = detectFlows(endpoints, contents);
    const r = persistFlows(project.id, run.version, drafts);
    summary.push(`flows=${r.inserted}`, `flowsSkipped=${r.skipped}`);
    note("flows", `flows:${drafts.length}/${drafts.length}`, summary.join(" "));
  }

  if (from("claims")) {
    // 结论层：把证据与流程合起来表述成带 derivation / review_state 的结论（确定性，不需要模型）
    const r = persistClaims(project.id, run.version);
    summary.push(`claims=${r.inserted}`, `claimsSkipped=${r.skipped}`, `claimLinks=${r.linked}`);
    note("claims", "claims:done", summary.join(" "));
  }

  if (from("audit")) {
    // 全库体检：正则扫 TODO/console/空 catch/debugger，写 repo_insights(health)
    const auditFiles = [...contents.entries()].map(([path, content]) => ({ path, content }));
    const r = runAudit(project.id, run.version, auditFiles);
    summary.push(`health=${r.inserted}`);
    note("audit", "audit:done", summary.join(" "));
  }

  if (from("edges")) {
    // 建边：CONTAINS(file→symbol) + IMPORTS(file→file)，写 edges 表
    const r = buildEdges(project.id, run.version, root);
    summary.push(`edges=${r.inserted}`, `edgesImports=${r.imports}`, `edgesContains=${r.contains}`);
    note("edges", "edges:done", summary.join(" "));
  }

  if (from("gitlog")) {
    // git 考古：最近 50 条提交，写 history_events；无 git 静默降级
    const r = runGitArchaeology(project.id, run.version, root);
    summary.push(`commits=${r.commits}`, `git=${r.available ? "ok" : "unavailable"}`);
    note("gitlog", "gitlog:done", summary.join(" "));
  }

  if (from("architecture")) {
    // 架构总览：LLM 生成 repo_insights(architecture)
    await llmStage("architecture", async () => {
      const r = await analyzeArchitecture(project.id, run.version, contextParts());
      return `arch=${r.inserted}`;
    });
  }

  if (from("nodes")) {
    await llmStage("nodes", async () => {
      const r = await analyzeNodes(project.id, run.version, contextParts());
      return `nodes=${r.inserted}`;
    });
  }

  if (from("terms")) {
    await llmStage("terms", async () => {
      const r = await analyzeTerms(project.id, run.version, contextParts());
      return `terms=${r.inserted}`;
    });
  }

  if (from("confusions")) {
    await llmStage("confusions", async () => {
      const r = await analyzeConfusions(project.id, run.version, contextParts());
      return `confusions=${r.inserted}`;
    });
  }

  if (from("techpath")) {
    await llmStage("techpath", async () => {
      const r = await analyzeTechPath(project.id, run.version, contextParts());
      return `techpath=${r.inserted}`;
    });
  }

  if (from("module")) {
    // 模块深挖：LLM 生成 repo_insights(module)
    await llmStage("module", async () => {
      const r = await analyzeModuleDeep(project.id, run.version, contextParts());
      return `moduleInsights=${r.inserted}`;
    });
  }

  if (from("practice")) {
    await llmStage("practice", async () => {
      const r = await analyzePractice(project.id, run.version, contextParts());
      return `practice=${r.inserted}`;
    });
  }

  if (from("dualcheck")) {
    // 双重校验：对 claims 做四查，失败写 open_questions
    const r = runDualCheck(project.id, run.version);
    summary.push(`dualFlagged=${r.flagged}`, `openQs=${r.openQuestions}`);
    note("dualcheck", "dualcheck:done", summary.join(" "));
  }

  if (from("coverage")) {
    // 六维覆盖报告：files/symbols/references/flows/external_deps/runtime
    const r = runCoverage(project.id, run.version);
    summary.push(`coverage=${r.dims}dims`);
    note("coverage", "coverage:done", summary.join(" "));
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