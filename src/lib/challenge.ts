/**
 * P4 实战挑战基础设施（设计依据：challenge/drill SPEC + 计划 §11-12）。
 *
 * 双轨隔离：
 *   git 项目   → git worktree --detach（原目录零影响，天然 diff/回滚）
 *   非 git 项目 → 副本目录（baseline/ 存原件，workspace/ 供修改），回滚=复制回去
 *
 * 安全边界（Auth）：
 *   L5 修改授权：projects.allow_modify 必须为 1，且每次 start 记录 auth_l5_at
 *   L2 验证授权：命令逐条副作用审查（黑名单 + 记录 auth_l2_at），cwd 锁定工作区
 *
 * 诚实边界：worktree 不是沙箱；本模块只做隔离与记录，不承诺防御恶意代码。
 */
import { getDb } from "./db";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { createTwoFilesPatch } from "diff";

const WORKSPACES = path.join(process.cwd(), "data", "workspaces");
const MAX_COPY_BYTES = 200 * 1024 * 1024;

export type StartResult = {
  runId: number;
  workspacePath: string;
  mode: "worktree" | "copy";
  targetFile: string | null;
};

function isGitRepo(root: string): boolean {
  return fs.existsSync(path.join(root, ".git"));
}

function git(root: string, args: string): string | null {
  try {
    return execSync(`git ${args}`, { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 30_000 });
  } catch {
    return null;
  }
}

/** 递归拷贝目录（跳过噪音与超大文件），返回拷贝的文件数 */
function copyTree(src: string, dest: string, relBase = ""): { files: number; manifest: Record<string, string> } {
  fs.mkdirSync(dest, { recursive: true });
  let files = 0;
  const manifest: Record<string, string> = {};
  const walk = (cur: string, rel: string) => {
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, entry.name);
      const relPath = path.join(rel, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", ".next", "data"].includes(entry.name)) continue;
        walk(abs, relPath);
        continue;
      }
      const st = fs.statSync(abs);
      if (st.size > 20 * 1024 * 1024) continue;
      const destAbs = path.join(dest, relPath);
      fs.mkdirSync(path.dirname(destAbs), { recursive: true });
      fs.copyFileSync(abs, destAbs);
      manifest[relPath] = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
      files += 1;
    }
  };
  walk(src, relBase);
  return { files, manifest };
}

/** 启动挑战：创建隔离工作区（Auth-L5 已在上层校验并记录） */
export function startWorkspace(
  projectId: number,
  runId: number,
  kind: "modify" | "mutation"
): StartResult {
  const db = getDb();
  const project = db.prepare("SELECT root_path FROM projects WHERE id = ?").get(projectId) as
    | { root_path: string }
    | undefined;
  if (!project) throw new Error("项目不存在");
  const root = fs.realpathSync(project.root_path);

  const wsBase = path.join(WORKSPACES, `ch-${runId}`);
  const gitMode = isGitRepo(root);
  let mode: "worktree" | "copy";
  let workspacePath: string;
  let baselinePath: string | null = null;
  let baselineCommit: string | null = null;

  if (gitMode) {
    mode = "worktree";
    workspacePath = path.join(WORKSPACES, `ch-${runId}-wt`);
    fs.rmSync(workspacePath, { recursive: true, force: true });
    execSync(`git worktree add --detach "${workspacePath}" HEAD`, { cwd: root, stdio: "ignore", timeout: 60_000 });
    baselineCommit = git(root, "rev-parse HEAD")?.trim() ?? null;
  } else {
    mode = "copy";
    workspacePath = path.join(WORKSPACES, `ch-${runId}-ws`);
    baselinePath = path.join(WORKSPACES, `ch-${runId}-base`);
    fs.rmSync(workspacePath, { recursive: true, force: true });
    fs.rmSync(baselinePath, { recursive: true, force: true });
    const copied = copyTree(root, workspacePath);
    copyTree(root, baselinePath);
    if (copied.files === 0) throw new Error("项目无文件可拷贝");
  }

  db.prepare(
    `INSERT INTO challenge_runs (challenge_id, project_id, run_type, workspace_mode, workspace_path, baseline_path, baseline_commit, auth_l5_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`
  ).run(kind === "mutation" ? mutationChallengeId(db, projectId, runId) : challengeIdFor(db, projectId), projectId, kind, mode, workspacePath, baselinePath, baselineCommit);

  return { runId: latestRunId(db, projectId), workspacePath, mode, targetFile: null };
}

// challenge_runs.challenge_id 引用 challenges 表——mutation/快速模式可能没有预建 challenge 行，
// 这里保证引用非空：取该项目最新一条挑战，没有则创建一条占位（kind 同 run_type）。
function challengeIdFor(db: ReturnType<typeof getDb>, projectId: number): number {
  const row = db
    .prepare("SELECT id FROM challenges WHERE project_id = ? ORDER BY id DESC LIMIT 1")
    .get(projectId) as { id: number } | undefined;
  if (row) return row.id;
  const info = db
    .prepare(
      "INSERT INTO challenges (project_id, analysis_version, slug, kind, title, status) VALUES (?, 'adhoc', 'adhoc-challenge', 'modify', '临时改码挑战', 'confirmed')"
    )
    .run(projectId, "adhoc");
  return Number(info.lastInsertRowid);
}
function mutationChallengeId(db: ReturnType<typeof getDb>, projectId: number, _runId: number): number {
  const row = db
    .prepare("SELECT id FROM challenges WHERE project_id = ? AND kind = 'mutation' ORDER BY id DESC LIMIT 1")
    .get(projectId) as { id: number } | undefined;
  if (row) return row.id;
  const info = db
    .prepare(
      "INSERT INTO challenges (project_id, analysis_version, slug, kind, title, status) VALUES (?, 'adhoc', 'adhoc-mutation', 'mutation', '破坏实验', 'confirmed')"
    )
    .run(projectId, "adhoc");
  return Number(info.lastInsertRowid);
}
function latestRunId(db: ReturnType<typeof getDb>, projectId: number): number {
  return (db.prepare("SELECT id FROM challenge_runs WHERE project_id = ? ORDER BY id DESC LIMIT 1").get(projectId) as { id: number }).id;
}

export type DiffFile = { path: string; patch: string; added: number; removed: number };

/** 变更差异：workspace 与 baseline 逐文件对比（jsdiff unified patch） */
export function readDiff(projectId: number, runId: number): { mode: string; files: DiffFile[]; modified: boolean } {
  const db = getDb();
  const run = db.prepare("SELECT * FROM challenge_runs WHERE id = ?").get(runId) as
    | { workspace_mode: string; workspace_path: string; baseline_path: string | null }
    | undefined;
  if (!run) throw new Error("挑战运行不存在");

  const files: DiffFile[] = [];
  const ws = run.workspace_path;
  const base = run.workspace_mode === "worktree" ? gitBaseTree(runId) : run.baseline_path ?? "";

  const collect = (dir: string, rel: string, out: Map<string, string>) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) continue;
        collect(abs, relPath, out);
      } else if (entry.isFile()) {
        out.set(relPath, fs.readFileSync(abs, "utf8"));
      }
    }
  };
  const wsFiles = new Map<string, string>();
  collect(ws, "", wsFiles);
  const baseFiles = new Map<string, string>();
  if (run.workspace_mode === "copy" && base) collect(base, "", baseFiles);

  // git worktree 模式：直接用 git diff
  if (run.workspace_mode === "worktree") {
    const patch = git(ws, "diff HEAD --unified=3");
    const paths = [...wsFiles.keys()];
    for (const p of paths) {
      const a = baseFiles.get(p) ?? gitShow(runId, p);
      void a;
    }
    // 解析 git diff 输出为逐文件 patch
    const chunks = patch?.split(/\n(?=diff --git )/g) ?? [];
    for (const chunk of chunks) {
      const m = chunk.match(/b\/(.+)$/m);
      if (!m) continue;
      const p = m[1];
      const added = (chunk.match(/^\+[^+]/gm) ?? []).length;
      const removed = (chunk.match(/^-[^-]/gm) ?? []).length;
      files.push({ path: p, patch: chunk, added, removed });
    }
    const modified = files.length > 0;
    db.prepare("UPDATE challenge_runs SET diff = ?, modified = ? WHERE id = ?").run(
      JSON.stringify(files.map((f) => f.path)),
      modified ? 1 : 0,
      runId
    );
    return { mode: run.workspace_mode, files, modified };
  }

  // copy 模式：baseline 与 workspace 全量对比
  const allPaths = new Set([...wsFiles.keys(), ...baseFiles.keys()]);
  for (const p of allPaths) {
    const a = baseFiles.get(p) ?? "";
    const b = wsFiles.get(p) ?? "";
    if (a === b) continue;
    const patch = createTwoFilesPatch(`a/${p}`, `b/${p}`, a, b, "baseline", "workspace");
    const added = (patch.match(/^\+[^+]/gm) ?? []).length;
    const removed = (patch.match(/^-[^-]/gm) ?? []).length;
    files.push({ path: p, patch, added, removed });
  }
  const modified = files.length > 0;
  db.prepare("UPDATE challenge_runs SET diff = ?, modified = ? WHERE id = ?").run(
    JSON.stringify(files.map((f) => f.path)),
    modified ? 1 : 0,
    runId
  );
  return { mode: run.workspace_mode, files, modified };
}

function gitShow(_runId: number, _p: string): string {
  return ""; // worktree 模式用 git diff 输出，无需逐文件基线
}
function gitBaseTree(_runId: number): string {
  return ""; // worktree 模式走 git diff 分支
}

/** 命令副作用审查（Auth-L2）：黑名单 + 记录。返回 null 表示通过，否则返回拒绝原因。 */
export function reviewCommand(command: string): string | null {
  const c = command.toLowerCase();
  const blocked = [
    /\brm\s+-rf?\s+[\/~]/,
    /\bdel\s+\/[sq]/,
    /\brd\s+\/s/,
    /\bformat\b/,
    /\bmkfs/,
    /\bshutdown\b/,
    /\bgit\s+push\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\breg\s+delete\b/,
    /remove-item\s+-recurse/,
    /\bcurl\b.*\|\s*(sh|bash|powershell)/,
    /\bnpm\s+publish\b/,
    /\bdrop\s+(table|database)\b/i,
  ];
  for (const re of blocked) if (re.test(c)) return `命令命中副作用黑名单：${re.source}`;
  return null;
}

export type VerifyResult = {
  exitCode: number;
  output: string;
  proofType: string;
  timedOut: boolean;
};

/** 运行验证命令（Auth-L2 单次授权后调用）：cwd 锁定工作区 + 超时 + 输出上限 */
export function runVerify(projectId: number, runId: number, command: string): VerifyResult {
  const db = getDb();
  const run = db.prepare("SELECT workspace_mode, workspace_path FROM challenge_runs WHERE id = ?").get(runId) as
    | { workspace_mode: string; workspace_path: string }
    | undefined;
  if (!run) throw new Error("挑战运行不存在");

  const proofType = /test|spec|vitest|jest|pytest/i.test(command)
    ? "unit_test"
    : /tsc|typecheck|build/i.test(command)
      ? "type_build"
      : /lint|eslint/i.test(command)
        ? "static_lint"
        : "command";

  let exitCode = -1;
  let output = "";
  let timedOut = false;
  try {
    output = execSync(command, {
      cwd: run.workspace_path,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 200 * 1024,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    exitCode = 0;
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string; signal?: string };
    exitCode = e.status ?? 1;
    output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    if (e.signal === "SIGTERM") timedOut = true;
  }
  output = output.slice(0, 100_000);

  const result = exitCode === 0 ? "passed" : "failed";
  db.prepare(
    `INSERT INTO runtime_proofs (project_id, challenge_run_id, proof_type, command, environment, exit_code, output_summary, asserted_scope, uncovered, result)
     VALUES (?, ?, ?, ?, 'workspace', ?, ?, ?, ?, ?)`
  ).run(
    projectId,
    runId,
    proofType,
    command,
    exitCode,
    output.slice(0, 2000),
    `工作区内命令执行：${command}`,
    "未覆盖：工作区外的集成场景与真实运行时行为",
    result
  );
  db.prepare(
    "UPDATE challenge_runs SET verify_command = ?, verify_status = ?, verify_output = ?, auth_l2_at = datetime('now','localtime') WHERE id = ?"
  ).run(command, result === "passed" ? "passed" : "failed", output.slice(0, 2000), runId);

  return { exitCode, output: output.slice(-4000), proofType, timedOut };
}

/** 回滚：copy 模式复制 baseline 回 workspace；worktree 模式 checkout 还原 */
export function rollback(projectId: number, runId: number): { ok: boolean; mode: string } {
  const db = getDb();
  const run = db.prepare("SELECT * FROM challenge_runs WHERE id = ?").get(runId) as
    | { workspace_mode: string; workspace_path: string; baseline_path: string | null }
    | undefined;
  if (!run) throw new Error("挑战运行不存在");
  if (run.workspace_mode === "worktree") {
    execSync("git checkout -- . && git clean -fd", { cwd: run.workspace_path, stdio: "ignore", timeout: 30_000 });
  } else if (run.baseline_path) {
    // 用 baseline 覆盖 workspace
    const base = run.baseline_path;
    const ws = run.workspace_path;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      const abs = path.join(base, entry.name);
      const dest = path.join(ws, entry.name);
      if (entry.isDirectory()) fs.cpSync(abs, dest, { recursive: true });
      else fs.copyFileSync(abs, dest);
    }
  }
  db.prepare("UPDATE challenge_runs SET rolled_back = 1, modified = 0, ended_at = datetime('now','localtime') WHERE id = ?").run(runId);
  return { ok: true, mode: run.workspace_mode };
}

/** 终局三态：modified / verifyExecuted / accepted（验收=diff 非空 + 验证通过 + 未回滚） */
export function finalize(projectId: number, runId: number): { modified: boolean; verifyExecuted: boolean; verifyPassed: boolean; accepted: boolean } {
  const db = getDb();
  const read = readDiff(projectId, runId);
  const run = db.prepare("SELECT verify_status, verify_command, rolled_back FROM challenge_runs WHERE id = ?").get(runId) as
    | { verify_status: string; verify_command: string | null; rolled_back: number }
    | undefined;
  const verifyExecuted = Boolean(run?.verify_command);
  const verifyPassed = run?.verify_status === "passed";
  const modified = read.modified;
  const accepted = modified && verifyExecuted && verifyPassed && !run?.rolled_back ? true : false;
  db.prepare(
    "UPDATE challenge_runs SET accepted = ?, ended_at = datetime('now','localtime') WHERE id = ?"
  ).run(accepted ? 1 : 0, runId);
  return { modified, verifyExecuted, verifyPassed, accepted };
}
