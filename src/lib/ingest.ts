import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import AdmZip from "adm-zip";
import { getDb } from "./db";
import { detectStack } from "./scan";

export const NOISE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "venv",
  "__pycache__", ".idea", ".vscode", "coverage", ".gradle", "target",
]);

const MAX_ZIP_TOTAL = 500 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 20000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_HASH_BYTES = 10 * 1024 * 1024;

export function sha256File(p: string): string {
  const stat = fs.statSync(p);
  const h = crypto.createHash("sha256");
  if (stat.size > MAX_HASH_BYTES) {
    // 超大文件哈希前 10MB，避免扫描期开销失控
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(MAX_HASH_BYTES);
    fs.readSync(fd, buf, 0, MAX_HASH_BYTES, 0);
    fs.closeSync(fd);
    h.update(buf);
    h.update(`oversize:${stat.size}`);
  } else {
    h.update(fs.readFileSync(p));
  }
  return h.digest("hex");
}

function sha256Buf(b: Buffer): string {
  return crypto.createHash("sha256").update(b).digest("hex");
}

function countLines(buf: Buffer): number {
  if (buf.length > MAX_FILE_BYTES) return 0;
  let n = 0;
  for (let i = 0; i < buf.length; i += 1) if (buf[i] === 0x0a) n += 1;
  return n;
}

export type ImportResult = { projectId: number; fileCount: number; runId: number };

/** 路径导入：realpath 授权 + 递归扫描 + 快照。噪音目录跳过。 */
export function importFromPath(slug: string, name: string, rawPath: string): ImportResult {
  const root = fs.realpathSync(rawPath);
  if (!fs.statSync(root).isDirectory()) throw new Error("路径不是目录");
  const db = getDb();
  const exists = db.prepare("SELECT id FROM projects WHERE slug = ?").get(slug);
  if (exists) throw new Error(`slug 已存在：${slug}`);
  const info = db
    .prepare("INSERT INTO projects (slug, name, source_type, root_path) VALUES (?, ?, 'path', ?)")
    .run(slug, name, root);
  const projectId = Number(info.lastInsertRowid);
  return finishImport(projectId, root);
}

/** zip 导入：条目消毒 + 上限防炸弹，解压到 data/workspaces/<slug>（相对路径，便携） */
export function importFromZip(slug: string, name: string, zipPath: string): ImportResult {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  if (entries.length > MAX_ZIP_ENTRIES) throw new Error(`zip 条目数超限（>${MAX_ZIP_ENTRIES}）`);
  let total = 0;
  const workspace = path.join(process.cwd(), "data", "workspaces", slug);
  fs.mkdirSync(workspace, { recursive: true });
  for (const e of entries) {
    const name0 = e.entryName;
    if (name0.includes("..") || path.isAbsolute(name0)) {
      throw new Error(`zip 条目路径非法：${name0}`);
    }
    if (e.isDirectory) continue;
    const content = e.getData();
    total += content.length;
    if (total > MAX_ZIP_TOTAL) throw new Error("zip 解压总量超限");
    if (content.length > MAX_FILE_BYTES) throw new Error(`单文件超限：${name0}`);
    // 中文文件名编码：无 UTF-8 标志位（bit 0x800）时按 gbk 解码重排
    let rel = name0;
    if (!(e.header.flags & 0x800)) {
      try {
        const gbk = new TextDecoder("gbk").decode(Buffer.from(name0, "latin1"));
        if (!/[\uFFFD]/.test(gbk)) rel = gbk.replace(/\\/g, "/");
      } catch {
        /* 保留原名 */
      }
    }
    const dest = path.join(workspace, rel);
    if (!path.resolve(dest).startsWith(path.resolve(workspace))) {
      throw new Error(`解压越界：${name0}`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  const db = getDb();
  const exists = db.prepare("SELECT id FROM projects WHERE slug = ?").get(slug);
  if (exists) throw new Error(`slug 已存在：${slug}`);
  const root = fs.realpathSync(workspace);
  const info = db
    .prepare("INSERT INTO projects (slug, name, source_type, root_path) VALUES (?, ?, 'zip', ?)")
    .run(slug, name, root);
  return finishImport(Number(info.lastInsertRowid), root);
}

/** 写 files + 生成 scan 运行与 run_files 快照 + 栈识别 */
function finishImport(projectId: number, root: string): ImportResult {
  const db = getDb();
  const stack = detectStack(root);
  db.prepare("UPDATE projects SET stack = ? WHERE id = ?").run(JSON.stringify(stack), projectId);

  const version = "scan-v1";
  const runInfo = db
    .prepare(
      "INSERT INTO analysis_runs (project_id, version, kind, status, stage, step) VALUES (?, ?, 'scan', 'running', 'walk', '')"
    )
    .run(projectId, version);
  const runId = Number(runInfo.lastInsertRowid);

  const insFile = db.prepare(
    "INSERT INTO files (project_id, path, ext, loc, parse_mode, content_hash) VALUES (?, ?, ?, ?, 'text_only', ?)"
  );
  const insRunFile = db.prepare(
    "INSERT OR REPLACE INTO run_files (run_id, project_id, path, size, mtime, sha256) VALUES (?, ?, ?, ?, ?, ?)"
  );

  let fileCount = 0;
  const walk = (dir: string, relBase: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (NOISE_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name), path.join(relBase, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.join(relBase, entry.name).replace(/\\/g, "/");
      let stat: fs.Stats;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      const ext = path.extname(entry.name).slice(0, 16) || null;
      let loc = 0;
      let hash: string | null = null;
      try {
        hash = sha256File(abs);
        if (stat.size <= MAX_FILE_BYTES) loc = countLines(fs.readFileSync(abs));
      } catch {
        hash = null;
      }
      insFile.run(projectId, rel, ext, loc, hash);
      insRunFile.run(runId, projectId, rel, stat.size, stat.mtime.toISOString(), hash ?? "");
      fileCount += 1;
    }
  };
  const tx = db.transaction(() => walk(root, ""));
  tx();

  db.prepare(
    "UPDATE analysis_runs SET status = 'completed', stage = 'done', progress_note = ? WHERE id = ?"
  ).run(`files=${fileCount}`, runId);
  return { projectId, fileCount, runId };
}
