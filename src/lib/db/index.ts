import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __palDb: Database.Database | undefined;
}

function runMigrations(db: Database.Database) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  );
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;
  const current = row ? Number(row.value) : 0;
  const dir = path.join(process.cwd(), "src", "lib", "db", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const version = Number(file.slice(0, 4));
    if (version <= current) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    // 迁移事务化：任一失败整体回滚，schema_version 不推进
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO meta (key, value) VALUES ('schema_version', ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(String(version));
    })();
  }
}

export function getDb(): Database.Database {
  if (globalThis.__palDb) return globalThis.__palDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  runMigrations(db);
  globalThis.__palDb = db;
  return db;
}

export const DB_PATH_EXPORT = DB_PATH;

/**
 * 删除一个项目的全部派生数据（脚本与测试复用，避免各处 cleanup 漏删新表）。
 * 顺序固定：先删引用 files 的子表（symbols.file_id 外键 + foreign_keys=ON），再删 files。
 */
export function deleteProjectData(projectId: number): void {
  const db = getDb();
  const stmts = [
    "DELETE FROM flow_steps WHERE project_id = ?",
    "DELETE FROM flows WHERE project_id = ?",
    "DELETE FROM nodes WHERE project_id = ?",
    "DELETE FROM practice_items WHERE project_id = ?",
    "DELETE FROM repo_insights WHERE project_id = ?",
    "DELETE FROM history_events WHERE project_id = ?",
    "DELETE FROM terms WHERE project_id = ?",
    "DELETE FROM open_questions WHERE project_id = ?",
    "DELETE FROM coverage_stats WHERE project_id = ?",
    "DELETE FROM claims WHERE project_id = ?",
    "DELETE FROM edges WHERE project_id = ?",
    "DELETE FROM symbols WHERE project_id = ?",
    "DELETE FROM evidence WHERE project_id = ?",
    "DELETE FROM run_files WHERE project_id = ?",
    "DELETE FROM files WHERE project_id = ?",
    "DELETE FROM analysis_runs WHERE project_id = ?",
  ];
  db.transaction(() => {
    for (const sql of stmts) db.prepare(sql).run(projectId);
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  })();
}