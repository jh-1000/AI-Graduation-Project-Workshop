/** C 组：最小可信闭环 C1-C5（只证明闭环存在，不代替完整风险验证） */
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { getDb } from "../../src/lib/db";
import { importFromPath } from "../../src/lib/ingest";
import { extractSymbolsTs } from "../../src/lib/symbols";
import { createRun, recoverStaleRuns, getRun } from "../../src/lib/tasks";
import { getApiKeyInternal } from "../../src/lib/settings";

const FIXTURE_ROOT = path.join(process.cwd(), "fixtures", "fixture1-todo-clip");
const SLUG = "c-loop-fixture1";
const results: { id: string; status: string; detail: string }[] = [];

function record(id: string, status: string, detail: string) {
  results.push({ id, status, detail });
  console.log(`[${status}] ${id} — ${detail}`);
}

function cleanup() {
  const db = getDb();
  const p = db.prepare("SELECT id FROM projects WHERE slug = ?").get(SLUG) as { id: number } | undefined;
  if (!p) return;
  db.prepare("DELETE FROM run_files WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM files WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM analysis_runs WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM projects WHERE id = ?").run(p.id);
}

function spawnWorker(runId: number, extra: string[] = []) {
  // 直接 node + tsx/cli（npx.cmd 经 spawn 不可靠）
  const tsxCli = require.resolve("tsx/cli");
  return spawn(process.execPath, [tsxCli, "worker/worker.ts", "--run-id", String(runId), ...extra], {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
  });
}

function waitForStatus(runId: number, statuses: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const t = setInterval(() => {
      const run = getRun(runId) as { status: string } | undefined;
      if (run && statuses.includes(run.status)) {
        clearInterval(t);
        resolve(run.status);
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(t);
        reject(new Error(`等待超时：当前 ${run?.status ?? "unknown"}`));
      }
    }, 500);
  });
}

async function main() {
  // C1 导入 + 安全扫描 + 文件清单
  cleanup();
  const imported = importFromPath(SLUG, "C 组闭环", FIXTURE_ROOT);
  record(
    "C1",
    imported.fileCount === 6 ? "PASS" : "FAIL",
    `导入 ${imported.fileCount} 个文件（预期 6）`
  );

  // C2 ts-morph 符号与可定位证据
  const symbols = extractSymbolsTs(FIXTURE_ROOT, ["src/utils/format.ts", "src/web/TasksPage.tsx"]);
  const names = new Set(symbols.map((s) => s.name));
  const c2ok = ["formatDate", "TasksPage", "handleSubmit"].every((s) => names.has(s));
  record("C2", c2ok ? "PASS" : "FAIL", `符号抽取：${symbols.map((s) => `${s.name}@${s.file}:${s.line}`).join(", ")}`);

  // C3 任务写入 + 模拟中断恢复（小批次+慢节奏，确保 kill 落在批次之间）
  const runId = createRun(imported.projectId, "scan", `c3-${Date.now()}`);
  let child = spawnWorker(runId, ["--batch=2", "--slow=1500"]);
  await new Promise((r) => setTimeout(r, 1200)); // 让它跑完第 1 批、进入第 2 批
  try {
    execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
  } catch {
    /* 进程树可能已退出（worker 提前完成）——C3a 将据状态判定 */
  }
  const afterKill = getRun(runId) as { status: string; step: string | null };
  if (afterKill.status !== "running") {
    record("C3a", "FAIL", `kill 窗口未命中运行中任务（status=${afterKill.status}），请调大 --slow 重试`);
  } else {
    // 手动让心跳过期（真实场景由时间流逝产生），执行启动恢复
    getDb()
      .prepare("UPDATE analysis_runs SET heartbeat_at = datetime('now','localtime','-60 seconds') WHERE id = ?")
      .run(runId);
    const recovered = recoverStaleRuns();
    const queued = getRun(runId) as { status: string; recovery_count: number };
    record(
      "C3a",
      recovered.includes(runId) && queued.status === "queued" ? "PASS" : "FAIL",
      `强杀后 status=running/step=${afterKill.step ?? "-"} → 恢复为 ${queued.status}（recovery_count=${queued.recovery_count}）`
    );
  }
  child = spawnWorker(runId, ["--batch=50", "--slow=0"]);
  const finalStatus = await waitForStatus(runId, ["completed", "failed"], 60_000);
  const runFiles = (getDb()
    .prepare("SELECT COUNT(*) AS n FROM run_files WHERE run_id = ?")
    .get(runId) as { n: number }).n;
  const filesRows = (getDb()
    .prepare("SELECT COUNT(*) AS n FROM files WHERE project_id = ? AND content_hash IS NOT NULL AND content_hash != ''")
    .get(imported.projectId) as { n: number }).n;
  record(
    "C3b",
    finalStatus === "completed" && runFiles === imported.fileCount && filesRows === imported.fileCount
      ? "PASS"
      : "FAIL",
    `恢复后续跑至 ${finalStatus}；run_files=${runFiles}；files 已哈希=${filesRows}`
  );

  // C4 LLM 带证据结论（需 API Key）
  if (!getApiKeyInternal()) {
    record("C4", "SKIP", "未配置 API Key：到设置页保存后重跑本脚本");
  } else {
    record("C4", "SKIP", "P0 骨架未含结论生成管线（Map 阶段属 P2）；Key 已就绪，P2 期间自动覆盖");
  }

  // C5 回归脚本可运行（读最近一次 regression_results）
  const last = getDb()
    .prepare("SELECT passed FROM regression_results ORDER BY id DESC LIMIT 1")
    .get() as { passed: number } | undefined;
  record(
    "C5",
    last && last.passed === 1 ? "PASS" : "FAIL",
    last ? `最近回归 ${last.passed === 1 ? "通过" : "未通过"}（先运行 npm run regression）` : "尚无回归结果（先运行 npm run regression）"
  );

  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "data", "c-loop-report.json"),
    JSON.stringify(results, null, 2)
  );
  const failCount = results.filter((r) => r.status === "FAIL").length;
  console.log(failCount === 0 ? "\nC 组闭环：全部通过" : `\nC 组闭环：${failCount} 项失败`);
  process.exitCode = failCount === 0 ? 0 : 1;
}

void main();
